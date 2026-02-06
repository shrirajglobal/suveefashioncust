import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, MapPin, Clock, CheckCircle2, Loader2, AlertCircle, Calendar, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, differenceInMinutes } from "date-fns";

interface PunchRecord {
  log_id: string;
  punch_type: "IN" | "OUT";
  punch_time: string;
  selfie_image_url: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
}

interface LocationState {
  status: "idle" | "loading" | "ready" | "error";
  latitude: number | null;
  longitude: number | null;
  error: string | null;
}

type CameraPermissionState = "prompt" | "granted" | "denied" | "unknown";

const AttendanceTab = () => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraInitializedRef = useRef(false);

  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [todayPunches, setTodayPunches] = useState<PunchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPunching, setIsPunching] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionState>("unknown");
  const [isRetryingCamera, setIsRetryingCamera] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<LocationState>({
    status: "idle",
    latitude: null,
    longitude: null,
    error: null,
  });

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get employee ID for current user
  useEffect(() => {
    const fetchEmployeeId = async () => {
      if (!user) return;
      const { data, error } = await supabase.rpc("get_employee_id", { _user_id: user.id });
      if (!error && data) {
        setEmployeeId(data);
      }
    };
    fetchEmployeeId();
  }, [user]);

  // Fetch today's punches
  const fetchTodayPunches = useCallback(async () => {
    if (!employeeId) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("date", today)
      .order("punch_time", { ascending: true });

    if (!error && data) {
      setTodayPunches(data);
    }
    setIsLoading(false);
  }, [employeeId]);

  useEffect(() => {
    fetchTodayPunches();
  }, [fetchTodayPunches]);

  // Get GPS location
  useEffect(() => {
    setLocation({ status: "loading", latitude: null, longitude: null, error: null });
    
    if (!navigator.geolocation) {
      setLocation({ status: "error", latitude: null, longitude: null, error: "Geolocation not supported" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          status: "ready",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: null,
        });
      },
      (error) => {
        setLocation({
          status: "error",
          latitude: null,
          longitude: null,
          error: error.message,
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Check camera permission status
  const checkCameraPermission = useCallback(async (): Promise<CameraPermissionState> => {
    try {
      // Check if Permissions API is available
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: "camera" as PermissionName });
        return result.state as CameraPermissionState;
      }
      return "unknown";
    } catch {
      // Permissions API not supported (e.g., iOS Safari)
      return "unknown";
    }
  }, []);

  // Initialize camera with permission check
  const startCamera = useCallback(async () => {
    // Prevent multiple simultaneous initialization attempts
    if (cameraInitializedRef.current && streamRef.current) {
      // Check if stream is still active
      const tracks = streamRef.current.getTracks();
      if (tracks.length > 0 && tracks[0].readyState === "live") {
        setCameraReady(true);
        return;
      }
    }

    try {
      setIsRetryingCamera(true);
      setCameraError(null);

      // Check permission status first
      const permStatus = await checkCameraPermission();
      setCameraPermission(permStatus);

      if (permStatus === "denied") {
        setCameraError("Camera access was denied. Please enable it in your browser/device settings.");
        setIsRetryingCamera(false);
        return;
      }

      // Request camera access with fallback constraints
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
      } catch (constraintError) {
        // Fallback to basic video constraints
        console.warn("Falling back to basic video constraints:", constraintError);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }

      streamRef.current = stream;
      cameraInitializedRef.current = true;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Ensure video plays
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.warn("Auto-play failed, user interaction may be required:", playError);
        }
        
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
          setCameraPermission("granted");
        };
        
        // Also handle if metadata is already loaded
        if (videoRef.current.readyState >= 1) {
          setCameraReady(true);
          setCameraPermission("granted");
        }
      }
    } catch (error: any) {
      console.error("Camera error:", error);
      cameraInitializedRef.current = false;
      streamRef.current = null;
      
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setCameraPermission("denied");
        setCameraError("Camera access denied. Please grant permission in your browser settings and refresh.");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setCameraError("No camera found on this device.");
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        setCameraError("Camera is in use by another application. Please close other apps using the camera.");
      } else if (error.name === "OverconstrainedError") {
        setCameraError("Camera doesn't support the requested settings. Retrying with basic settings...");
        // Try again with basic constraints
        try {
          const basicStream = await navigator.mediaDevices.getUserMedia({ video: true });
          streamRef.current = basicStream;
          cameraInitializedRef.current = true;
          if (videoRef.current) {
            videoRef.current.srcObject = basicStream;
            await videoRef.current.play();
            setCameraReady(true);
            setCameraPermission("granted");
            setCameraError(null);
          }
        } catch (fallbackError) {
          console.error("Basic camera also failed:", fallbackError);
          setCameraError("Failed to access camera. Please check permissions.");
        }
      } else if (error.name === "AbortError") {
        setCameraError("Camera access was interrupted. Please try again.");
      } else if (error.name === "SecurityError") {
        setCameraError("Camera access blocked due to security policy. Please use HTTPS.");
      } else {
        setCameraError(error.message || "Failed to access camera. Please check your device settings.");
      }
    } finally {
      setIsRetryingCamera(false);
    }
  }, [checkCameraPermission]);

  // Retry camera access
  const retryCamera = useCallback(async () => {
    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    cameraInitializedRef.current = false;
    setCameraReady(false);
    setCameraError(null);
    await startCamera();
  }, [startCamera]);

  // Check if camera was previously granted - only auto-start if permission is already granted
  useEffect(() => {
    const checkAndInitCamera = async () => {
      const permStatus = await checkCameraPermission();
      setCameraPermission(permStatus);
      
      // Only auto-start if permission was already granted
      if (permStatus === "granted") {
        await startCamera();
      }
      // Otherwise, wait for user to click the "Enable Camera Access" button
    };
    
    checkAndInitCamera();

    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      cameraInitializedRef.current = false;
    };
  }, []); // Empty deps - only run once on mount

  // Handle visibility change - restart camera if page becomes visible and stream is dead
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        // Check if stream is still alive
        if (!streamRef.current || streamRef.current.getTracks().some(t => t.readyState === "ended")) {
          cameraInitializedRef.current = false;
          setCameraReady(false);
          await startCamera();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [startCamera]);

  // Capture selfie and upload
  const captureSelfie = async (): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current) return null;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0);
    
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8);
    });
    
    if (!blob) return null;

    const fileName = `${employeeId}/${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from("attendance-selfies")
      .upload(fileName, blob, { contentType: "image/jpeg" });

    if (error) {
      console.error("Failed to upload selfie:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("attendance-selfies")
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  // Handle punch in/out
  const handlePunch = async (type: "IN" | "OUT") => {
    if (!employeeId) {
      toast.error("Employee record not found");
      return;
    }
    
    if (!cameraReady) {
      toast.error("Camera is required for attendance");
      return;
    }
    
    if (location.status !== "ready") {
      toast.error("GPS location is required for attendance");
      return;
    }

    setIsPunching(true);
    try {
      const selfieUrl = await captureSelfie();
      if (!selfieUrl) {
        toast.error("Failed to capture selfie. Please try again.");
        setIsPunching(false);
        return;
      }

      const { error } = await supabase.from("attendance_logs").insert({
        employee_id: employeeId,
        punch_type: type,
        selfie_image_url: selfieUrl,
        gps_latitude: location.latitude,
        gps_longitude: location.longitude,
      });

      if (error) throw error;

      toast.success(`Punch ${type} recorded successfully!`);
      await fetchTodayPunches();
    } catch (error: any) {
      toast.error(error.message || "Failed to record punch");
    } finally {
      setIsPunching(false);
    }
  };

  // Calculate today's summary
  const getTodaySummary = () => {
    const punchIn = todayPunches.find(p => p.punch_type === "IN");
    const punchOut = [...todayPunches].reverse().find(p => p.punch_type === "OUT");
    
    let totalMinutes = 0;
    
    // Calculate total working time from pairs
    for (let i = 0; i < todayPunches.length; i++) {
      const current = todayPunches[i];
      if (current.punch_type === "IN") {
        const nextOut = todayPunches.slice(i + 1).find(p => p.punch_type === "OUT");
        if (nextOut) {
          totalMinutes += differenceInMinutes(
            new Date(nextOut.punch_time),
            new Date(current.punch_time)
          );
        }
      }
    }
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return {
      punchIn: punchIn ? format(new Date(punchIn.punch_time), "hh:mm a") : null,
      punchOut: punchOut ? format(new Date(punchOut.punch_time), "hh:mm a") : null,
      totalHours: totalMinutes > 0 ? `${hours}h ${minutes}m` : null,
    };
  };

  const summary = getTodaySummary();
  const lastPunch = todayPunches.length > 0 ? todayPunches[todayPunches.length - 1] : null;
  const nextPunchType: "IN" | "OUT" = lastPunch?.punch_type === "IN" ? "OUT" : "IN";
  const canPunch = cameraReady && location.status === "ready";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!employeeId) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Your account is not linked to an employee record. Please contact admin.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Current Date & Time */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="py-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-sm font-medium">
              {format(currentTime, "EEEE, dd MMMM yyyy")}
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight">
            {format(currentTime, "hh:mm:ss a")}
          </div>
        </CardContent>
      </Card>

      {/* Status Indicators */}
      <div className="flex justify-center gap-3">
        <Badge 
          variant={location.status === "ready" ? "default" : "destructive"} 
          className="gap-1.5 py-1.5 px-3"
        >
          <MapPin className="h-3.5 w-3.5" />
          GPS: {location.status === "ready" ? "Active" : location.status === "loading" ? "Loading..." : "Error"}
        </Badge>
        <Badge 
          variant={cameraReady ? "default" : "destructive"} 
          className="gap-1.5 py-1.5 px-3"
        >
          <Camera className="h-3.5 w-3.5" />
          Camera: {cameraReady ? "Ready" : cameraError ? "Error" : "Loading..."}
        </Badge>
      </div>

      {/* Camera Preview */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-[4/3] bg-muted">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
              style={{ transform: "scaleX(-1)" }}
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted p-4">
                {isRetryingCamera ? (
                  <div className="text-center space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground">Requesting camera access...</p>
                  </div>
                ) : cameraError ? (
                  <div className="text-center space-y-3">
                    <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
                    <p className="text-destructive text-sm max-w-xs">{cameraError}</p>
                    <Button 
                      variant="default" 
                      size="lg" 
                      onClick={retryCamera}
                      className="gap-2 mt-2"
                    >
                      <Camera className="h-5 w-5" />
                      Enable Camera Access
                    </Button>
                    {cameraPermission === "denied" && (
                      <p className="text-xs text-muted-foreground mt-3">
                        <strong>Permission blocked?</strong><br />
                        On iOS: Settings → Safari → Camera<br />
                        On Android: Settings → Apps → Browser → Permissions
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Camera className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Camera Required</p>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Selfie capture is required for attendance verification
                      </p>
                    </div>
                    <Button 
                      variant="default" 
                      size="lg" 
                      onClick={startCamera}
                      className="gap-2"
                    >
                      <Camera className="h-5 w-5" />
                      Enable Camera Access
                    </Button>
                  </div>
                )}
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </CardContent>
      </Card>

      {/* Punch Button */}
      <Button
        size="lg"
        variant={nextPunchType === "IN" ? "default" : "destructive"}
        className="w-full h-20 text-xl font-bold gap-3 rounded-xl shadow-lg"
        onClick={() => handlePunch(nextPunchType)}
        disabled={isPunching || !canPunch}
      >
        {isPunching ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Camera className="h-6 w-6" />
            Punch {nextPunchType}
          </>
        )}
      </Button>

      {!canPunch && !cameraError && (
        <p className="text-center text-sm text-destructive">
          {!cameraReady && !isRetryingCamera && "Camera access required. "}
          {location.status !== "ready" && "GPS location required."}
        </p>
      )}

      {/* Today's Summary */}
      <Card>
        <CardContent className="py-4">
          <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Today's Summary
          </h3>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Punch In</p>
              <p className="font-semibold text-lg">
                {summary.punchIn || (
                  <span className="text-muted-foreground">--:--</span>
                )}
              </p>
            </div>
            
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Punch Out</p>
              <p className="font-semibold text-lg">
                {summary.punchOut || (
                  <span className="text-muted-foreground">--:--</span>
                )}
              </p>
            </div>
            
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Hours</p>
              <p className="font-semibold text-lg text-primary">
                {summary.totalHours || (
                  <span className="text-muted-foreground">0h 0m</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Punch Confirmation */}
      {lastPunch && (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              {lastPunch.selfie_image_url && (
                <img
                  src={lastPunch.selfie_image_url}
                  alt="Last punch"
                  className="w-12 h-12 rounded-lg object-cover border"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">
                    Last Punch: {lastPunch.punch_type}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(lastPunch.punch_time), "hh:mm a")}
                  {lastPunch.gps_latitude && " • Location recorded"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AttendanceTab;
