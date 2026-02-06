import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface LocationTrackingState {
  isTracking: boolean;
  lastUpdate: Date | null;
  error: string | null;
  permissionStatus: "granted" | "denied" | "prompt" | "unknown";
}

const LOCATION_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SIGNIFICANT_DISTANCE_METERS = 100; // Only update if moved 100+ meters

export const useLocationTracking = () => {
  const { user } = useAuth();
  const [state, setState] = useState<LocationTrackingState>({
    isTracking: false,
    lastUpdate: null,
    error: null,
    permissionStatus: "unknown",
  });
  
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const employeeIdRef = useRef<string | null>(null);

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }, []);

  // Check if current time is within tracking hours
  const isWithinTrackingHours = useCallback(async (): Promise<boolean> => {
    if (!employeeIdRef.current) return false;

    try {
      const { data: settings } = await supabase
        .from("location_tracking_settings")
        .select("is_enabled, tracking_start_time, tracking_end_time")
        .eq("employee_id", employeeIdRef.current)
        .maybeSingle();

      if (!settings || !settings.is_enabled) {
        // If no settings, use default 9 AM - 6 PM
        const now = new Date();
        const hours = now.getHours();
        return hours >= 9 && hours < 18;
      }

      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      
      return currentTime >= settings.tracking_start_time && currentTime <= settings.tracking_end_time;
    } catch {
      // Default to work hours if check fails
      const now = new Date();
      const hours = now.getHours();
      return hours >= 9 && hours < 18;
    }
  }, []);

  // Save location to database
  const saveLocation = useCallback(async (position: GeolocationPosition) => {
    if (!employeeIdRef.current) return;

    const { latitude, longitude, accuracy } = position.coords;

    // Check if moved significantly
    if (lastPositionRef.current) {
      const distance = calculateDistance(
        lastPositionRef.current.lat,
        lastPositionRef.current.lng,
        latitude,
        longitude
      );
      
      if (distance < SIGNIFICANT_DISTANCE_METERS) {
        return; // Haven't moved enough, skip update
      }
    }

    try {
      const { error } = await supabase.from("employee_locations").insert({
        employee_id: employeeIdRef.current,
        latitude,
        longitude,
        accuracy,
      });

      if (!error) {
        lastPositionRef.current = { lat: latitude, lng: longitude };
        setState(prev => ({ ...prev, lastUpdate: new Date(), error: null }));
      }
    } catch (err) {
      console.error("Failed to save location:", err);
    }
  }, [calculateDistance]);

  // Get current location
  const updateLocation = useCallback(async () => {
    const withinHours = await isWithinTrackingHours();
    if (!withinHours) {
      return;
    }

    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: "Geolocation not supported" }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      saveLocation,
      (error) => {
        console.warn("Location error:", error.message);
      },
      {
        enableHighAccuracy: false, // Battery friendly
        timeout: 30000,
        maximumAge: 60000, // Accept cached position up to 1 min old
      }
    );
  }, [isWithinTrackingHours, saveLocation]);

  // Check permission status
  const checkPermission = useCallback(async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        setState(prev => ({ ...prev, permissionStatus: result.state as LocationTrackingState["permissionStatus"] }));
        
        result.addEventListener("change", () => {
          setState(prev => ({ ...prev, permissionStatus: result.state as LocationTrackingState["permissionStatus"] }));
        });
      }
    } catch {
      setState(prev => ({ ...prev, permissionStatus: "unknown" }));
    }
  }, []);

  // Start tracking
  const startTracking = useCallback(async () => {
    if (!user) return;

    // Get employee ID
    const { data: empId } = await supabase.rpc("get_employee_id", { _user_id: user.id });
    if (!empId) return;
    
    employeeIdRef.current = empId;

    // Check permission and start
    await checkPermission();
    
    if (state.permissionStatus === "denied") {
      setState(prev => ({ ...prev, error: "Location permission denied" }));
      return;
    }

    // Initial update
    await updateLocation();

    // Set up interval for periodic updates
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(updateLocation, LOCATION_UPDATE_INTERVAL);

    setState(prev => ({ ...prev, isTracking: true }));
  }, [user, checkPermission, updateLocation, state.permissionStatus]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState(prev => ({ ...prev, isTracking: false }));
  }, []);

  // Initialize on mount
  useEffect(() => {
    if (user) {
      startTracking();
    }

    return () => {
      stopTracking();
    };
  }, [user]); // Only re-run if user changes

  // Handle visibility change - pause when hidden, resume when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user) {
        updateLocation();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [updateLocation, user]);

  return {
    ...state,
    startTracking,
    stopTracking,
  };
};
