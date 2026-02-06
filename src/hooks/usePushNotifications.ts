import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission | "default";
}

// VAPID public key - this will be set from environment or edge function
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: "default",
  });

  // Check if push notifications are supported
  const checkSupport = useCallback(() => {
    const isSupported = 
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    
    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : "default",
    }));
    
    return isSupported;
  }, []);

  // Check existing subscription
  const checkSubscription = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      setState(prev => ({
        ...prev,
        isSubscribed: !!subscription,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Error checking push subscription:", error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user || !VAPID_PUBLIC_KEY) {
      toast.error("Push notifications are not configured");
      return false;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Request notification permission
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));

      if (permission !== "granted") {
        toast.error("Notification permission denied");
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      // Extract subscription data
      const subscriptionJson = subscription.toJSON();
      const keys = subscriptionJson.keys;

      if (!keys?.p256dh || !keys?.auth) {
        throw new Error("Invalid subscription keys");
      }

      // Save to database
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) throw error;

      setState(prev => ({ ...prev, isSubscribed: true, isLoading: false }));
      toast.success("Push notifications enabled!");
      return true;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      toast.error("Failed to enable push notifications");
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);
      }

      setState(prev => ({ ...prev, isSubscribed: false, isLoading: false }));
      toast.success("Push notifications disabled");
      return true;
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error("Failed to disable push notifications");
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  // Initialize
  useEffect(() => {
    checkSupport();
    checkSubscription();
  }, [checkSupport, checkSubscription]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    vapidKeyConfigured: !!VAPID_PUBLIC_KEY,
  };
};
