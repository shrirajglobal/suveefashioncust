import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
}

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
}

// Web Push implementation using Deno
async function sendWebPush(
  subscription: PushSubscription,
  payload: PushPayload,
  vapidPrivateKey: string,
  vapidPublicKey: string
): Promise<boolean> {
  try {
    // For web push, we need to use the web-push protocol
    // This is a simplified implementation - in production, use a proper web-push library
    
    const payloadString = JSON.stringify(payload);
    
    // Create JWT for VAPID
    const header = { alg: "ES256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      aud: new URL(subscription.endpoint).origin,
      exp: now + 12 * 60 * 60, // 12 hours
      sub: "mailto:admin@example.com",
    };

    // Import the private key
    const privateKeyData = base64UrlToArrayBuffer(vapidPrivateKey);
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      privateKeyData,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );

    // Create JWT
    const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const claimsB64 = btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const unsignedToken = `${headerB64}.${claimsB64}`;
    
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      cryptoKey,
      new TextEncoder().encode(unsignedToken)
    );
    
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    
    const jwt = `${unsignedToken}.${signatureB64}`;

    // Encrypt the payload
    const encryptedPayload = await encryptPayload(
      payloadString,
      subscription.p256dh,
      subscription.auth
    );

    // Send the push message
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
        "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
      },
      body: encryptedPayload,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Push failed: ${response.status} - ${text}`);
      return false;
    }

    await response.text(); // Consume response
    return true;
  } catch (error) {
    console.error("Error sending push:", error);
    return false;
  }
}

function base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<Uint8Array> {
  // This is a simplified placeholder - proper implementation requires
  // ECDH key exchange and AES-GCM encryption per Web Push protocol
  // For production, consider using a library or external service
  
  const encoder = new TextEncoder();
  return encoder.encode(payload);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_ids, title, body, url } = await req.json();

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "user_ids array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch subscriptions for users
    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", user_ids);

    if (fetchError) {
      throw fetchError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscriptions found", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: PushPayload = {
      title: title || "Reminder",
      body: body || "Time to connect with customers!",
      icon: "/pwa-192x192.png",
      url: url || "/",
    };

    // Send to all subscriptions
    let sent = 0;
    const failed: string[] = [];

    for (const sub of subscriptions) {
      const success = await sendWebPush(sub, payload, vapidPrivateKey, vapidPublicKey);
      if (success) {
        sent++;
      } else {
        failed.push(sub.endpoint);
        // Remove invalid subscriptions
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Sent ${sent} notifications`,
        sent,
        failed: failed.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
