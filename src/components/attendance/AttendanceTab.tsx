import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, MapPin, Clock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

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

const AttendanceTab = () => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [todayPunches, setTodayPunches] = useState<PunchRecord[]>([]);
  const [lastPunch, setLastPunch] = useState<PunchRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPunching, setIsPunching] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationState>({
    status: "idle",
    latitude: null,
    longitude: null,
    error: null,
  });

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
      setLastPunch(data.length > 0 ? data[data.length - 1] : null);
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

  // Initialize camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraReady(true);
        }
      } catch (error: any) {
        setCameraError(error.message || "Camera access denied");
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

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
    if (!employeeId || !cameraReady || location.status !== "ready") {
      toast.error("Camera and GPS must be ready");
      return;
    }

    setIsPunching(true);
    try {
      const selfieUrl = await captureSelfie();
      if (!selfieUrl) {
        toast.error("Failed to capture selfie");
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

      toast.success(`Punch ${type} recorded!`);
      await fetchTodayPunches();
    } catch (error: any) {
      toast.error(error.message || "Failed to record punch");
    } finally {
      setIsPunching(false);
    }
  };

  const nextPunchType: "IN" | "OUT" = lastPunch?.punch_type === "IN" ? "OUT" : "IN";

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
            <p>Your account is not linked to an employee record. Contact admin.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Indicators */}
      <div className="flex flex-wrap gap-2">
        <Badge variant={location.status === "ready" ? "default" : "secondary"} className="gap-1">
          <MapPin className="h-3 w-3" />
          GPS: {location.status === "ready" ? "Active" : location.status === "loading" ? "Loading..." : "Error"}
        </Badge>
        <Badge variant={cameraReady ? "default" : "secondary"} className="gap-1">
          <Camera className="h-3 w-3" />
          Camera: {cameraReady ? "Ready" : cameraError || "Loading..."}
        </Badge>
      </div>

      {/* Camera Preview */}
      <Card>
        <CardContent className="p-0 overflow-hidden rounded-lg">
          <div className="relative aspect-[4/3] bg-muted">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                {cameraError ? (
                  <p className="text-destructive text-sm">{cameraError}</p>
                ) : (
                  <Loader2 className="h-8 w-8 animate-spin" />
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
        className="w-full h-16 text-lg font-semibold gap-2"
        onClick={() => handlePunch(nextPunchType)}
        disabled={isPunching || !cameraReady || location.status !== "ready"}
      >
        {isPunching ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Camera className="h-5 w-5" />
        )}
        Punch {nextPunchType}
      </Button>

      {/* Last Punch Info */}
      {lastPunch && (
        <Card className="bg-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Last Punch: {lastPunch.punch_type}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {format(new Date(lastPunch.punch_time), "hh:mm a")}
            </div>
            {lastPunch.selfie_image_url && (
              <img
                src={lastPunch.selfie_image_url}
                alt="Selfie"
                className="w-20 h-20 rounded-lg object-cover"
              />
            )}
            {lastPunch.gps_latitude && lastPunch.gps_longitude && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                Location recorded
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Today's Punch History */}
      {todayPunches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Today's Punches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todayPunches.map((punch) => (
                <div
                  key={punch.log_id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={punch.punch_type === "IN" ? "default" : "secondary"}>
                      {punch.punch_type}
                    </Badge>
                    <span className="text-sm">
                      {format(new Date(punch.punch_time), "hh:mm a")}
                    </span>
                  </div>
                  {punch.selfie_image_url && (
                    <img
                      src={punch.selfie_image_url}
                      alt="Punch"
                      className="w-8 h-8 rounded object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AttendanceTab;
