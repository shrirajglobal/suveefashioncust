import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUsageTracking() {
  const { user } = useAuth();
  const hasLoggedAppOpen = useRef(false);

  // Log app open event (once per session)
  useEffect(() => {
    if (user && !hasLoggedAppOpen.current) {
      hasLoggedAppOpen.current = true;
      supabase
        .from("usage_events")
        .insert({ user_id: user.id, event_type: "app_open" })
        .then(({ error }) => {
          if (error) console.error("Failed to log app open:", error);
        });
    }
  }, [user]);

  // Log phone click event
  const logPhoneClick = useCallback(async () => {
    if (!user) return;
    
    const { error } = await supabase
      .from("usage_events")
      .insert({ user_id: user.id, event_type: "phone_click" });
    
    if (error) {
      console.error("Failed to log phone click:", error);
    }
  }, [user]);

  return { logPhoneClick };
}
