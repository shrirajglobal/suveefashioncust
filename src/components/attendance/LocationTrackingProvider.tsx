import { useEffect } from "react";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { useAuth } from "@/contexts/AuthContext";

/**
 * This component silently initializes location tracking for staff members.
 * It should be mounted once at the app level for employees who need tracking.
 */
const LocationTrackingProvider = () => {
  const { userRole } = useAuth();
  const { isTracking, error, permissionStatus } = useLocationTracking();

  // Only log errors in development, don't show UI
  useEffect(() => {
    if (error && process.env.NODE_ENV === "development") {
      console.warn("[LocationTracking]", error);
    }
  }, [error]);

  // This component doesn't render anything visible
  // It just initializes the tracking hook for staff/manager roles
  if (!userRole || !["staff", "manager"].includes(userRole)) {
    return null;
  }

  return null;
};

export default LocationTrackingProvider;
