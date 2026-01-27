import { useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Prevent duplicate app_open events when the hook is mounted in multiple places
// within the same SPA session (e.g., App + Index).
const loggedAppOpenForUsers = new Set<string>();

export function useUsageTracking() {
  const { user } = useAuth();

  // Log app open event (once per session)
  useEffect(() => {
    if (!user) return;
    if (loggedAppOpenForUsers.has(user.id)) return;

    loggedAppOpenForUsers.add(user.id);

      supabase
        .from("usage_events")
        .insert({ user_id: user.id, event_type: "app_open" })
        .then(({ error }) => {
          if (error) console.error("Failed to log app open:", error);
        });
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
