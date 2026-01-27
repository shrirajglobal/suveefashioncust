import { useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Prevent duplicate app_open events when the hook is mounted in multiple places
// within the same SPA session (e.g., App + Index).
const loggedAppOpenForUsers = new Set<string>();
const inFlightAppOpenForUsers = new Set<string>();

export function useUsageTracking() {
  const { user, session } = useAuth();

  // Log app open event (once per session)
  useEffect(() => {
    if (!user) return;
    // Ensure auth token is available before attempting to insert (helps on some devices/browsers)
    if (!session) return;
    if (loggedAppOpenForUsers.has(user.id)) return;
    if (inFlightAppOpenForUsers.has(user.id)) return;

    inFlightAppOpenForUsers.add(user.id);

    const insertAppOpen = async (attempt: 0 | 1) => {
      const { error } = await supabase
        .from("usage_events")
        .insert({ user_id: user.id, event_type: "app_open" });

      if (error) {
        // Sometimes the very first request races session initialization.
        // Retry once after a short delay.
        if (attempt === 0) {
          inFlightAppOpenForUsers.delete(user.id);
          setTimeout(() => {
            // Only retry if we still have the same signed-in user.
            if (!loggedAppOpenForUsers.has(user.id) && session) {
              inFlightAppOpenForUsers.add(user.id);
              void insertAppOpen(1);
            }
          }, 800);
          return;
        }

        console.error("Failed to log app open:", error);
        inFlightAppOpenForUsers.delete(user.id);
        return;
      }

      inFlightAppOpenForUsers.delete(user.id);
      loggedAppOpenForUsers.add(user.id);
    };

    void insertAppOpen(0);
  }, [user, session]);

  // Log phone click event
  const logPhoneClick = useCallback(async () => {
    if (!user) return;
    if (!session) return;
    
    const { error } = await supabase
      .from("usage_events")
      .insert({ user_id: user.id, event_type: "phone_click" });
    
    if (error) {
      console.error("Failed to log phone click:", error);
    }
  }, [user, session]);

  return { logPhoneClick };
}
