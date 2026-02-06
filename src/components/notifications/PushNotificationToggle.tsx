import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface PushNotificationToggleProps {
  showLabel?: boolean;
  size?: "sm" | "default" | "lg";
}

const PushNotificationToggle = ({ 
  showLabel = true, 
  size = "sm" 
}: PushNotificationToggleProps) => {
  const { 
    isSupported, 
    isSubscribed, 
    isLoading, 
    permission,
    vapidKeyConfigured,
    subscribe, 
    unsubscribe 
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <BellOff className="h-3 w-3 mr-1" />
        Push not supported
      </Badge>
    );
  }

  if (!vapidKeyConfigured) {
    return null; // Hide if not configured
  }

  if (permission === "denied") {
    return (
      <Badge variant="destructive" className="gap-1">
        <BellOff className="h-3 w-3" />
        {showLabel && "Notifications blocked"}
      </Badge>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <Button
      variant={isSubscribed ? "default" : "outline"}
      size={size}
      onClick={handleToggle}
      disabled={isLoading}
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSubscribed ? (
        <Bell className="h-4 w-4" />
      ) : (
        <BellOff className="h-4 w-4" />
      )}
      {showLabel && (isSubscribed ? "Notifications On" : "Enable Notifications")}
    </Button>
  );
};

export default PushNotificationToggle;
