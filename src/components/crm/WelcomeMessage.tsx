import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, AlertTriangle, Target, Sparkles, Flame } from "lucide-react";

interface WelcomeMessageProps {
  userName: string;
  callsMadeToday: number;
  customersContactedToday: number;
  overdueCount: number;
  highValueOverdueCount: number;
  avgDailyCalls?: number;
  salesTarget?: number;
  salesAchieved?: number;
}

interface MessageConfig {
  greeting: string;
  message: string;
  type: "achievement" | "improvement" | "neutral";
  icon: React.ReactNode;
  badges: { text: string; variant: "default" | "secondary" | "destructive" | "outline" }[];
}

export function WelcomeMessage({
  userName,
  callsMadeToday,
  customersContactedToday,
  overdueCount,
  highValueOverdueCount,
  avgDailyCalls = 0,
  salesTarget = 0,
  salesAchieved = 0,
}: WelcomeMessageProps) {
  const firstName = userName.split(" ")[0];
  const currentHour = new Date().getHours();
  
  const timeGreeting = useMemo(() => {
    if (currentHour < 12) return "Good morning";
    if (currentHour < 17) return "Good afternoon";
    return "Good evening";
  }, [currentHour]);

  const targetProgress = salesTarget > 0 ? (salesAchieved / salesTarget) * 100 : 0;
  const isOnTrack = callsMadeToday >= avgDailyCalls;
  const hasHighValueIssue = highValueOverdueCount > 0;
  const hasOverdueIssue = overdueCount > 5;

  const messageConfig: MessageConfig = useMemo(() => {
    // Achievement scenarios
    if (targetProgress >= 100) {
      return {
        greeting: `${timeGreeting}, ${firstName}! 🏆`,
        message: `Outstanding! You've crushed your sales target at ${Math.round(targetProgress)}%! Keep the momentum going.`,
        type: "achievement",
        icon: <Trophy className="h-5 w-5 text-primary" />,
        badges: [
          { text: "Target Achieved", variant: "default" as const },
          { text: `${Math.round(targetProgress)}% of target`, variant: "secondary" as const },
        ],
      };
    }

    if (callsMadeToday >= 10 && overdueCount === 0) {
      return {
        greeting: `${timeGreeting}, ${firstName}! ⭐`,
        message: `Fantastic work! ${callsMadeToday} calls today and no overdue customers. You're on fire!`,
        type: "achievement",
        icon: <Flame className="h-5 w-5 text-primary" />,
        badges: [
          { text: `${callsMadeToday} calls`, variant: "default" as const },
          { text: "All caught up", variant: "secondary" as const },
        ],
      };
    }

    if (targetProgress >= 75 && isOnTrack) {
      return {
        greeting: `${timeGreeting}, ${firstName}! 🎯`,
        message: `Great progress! You're at ${Math.round(targetProgress)}% of your target. A few more pushes and you'll hit it!`,
        type: "achievement",
        icon: <Target className="h-5 w-5 text-primary" />,
        badges: [
          { text: `${Math.round(targetProgress)}% progress`, variant: "default" as const },
          { text: "On track", variant: "secondary" as const },
        ],
      };
    }

    // Improvement scenarios
    if (hasHighValueIssue && highValueOverdueCount >= 3) {
      return {
        greeting: `${timeGreeting}, ${firstName}`,
        message: `You have ${highValueOverdueCount} high-value customers waiting to hear from you. Prioritize these today – they're your biggest revenue opportunities!`,
        type: "improvement",
        icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
        badges: [
          { text: `${highValueOverdueCount} high-value overdue`, variant: "destructive" as const },
          { text: "Action needed", variant: "outline" as const },
        ],
      };
    }

    if (hasOverdueIssue) {
      return {
        greeting: `${timeGreeting}, ${firstName}`,
        message: `${overdueCount} customers haven't heard from you in over 15 days. A quick call today can make all the difference!`,
        type: "improvement",
        icon: <AlertTriangle className="h-5 w-5 text-muted-foreground" />,
        badges: [
          { text: `${overdueCount} overdue`, variant: "destructive" as const },
          { text: "Follow up today", variant: "outline" as const },
        ],
      };
    }

    if (callsMadeToday === 0 && currentHour >= 10) {
      return {
        greeting: `${timeGreeting}, ${firstName}`,
        message: `Time to get started! Your first call of the day could lead to your next big sale. Let's make it count!`,
        type: "improvement",
        icon: <TrendingUp className="h-5 w-5 text-primary" />,
        badges: [
          { text: "No calls yet", variant: "outline" as const },
          { text: "Start strong", variant: "secondary" as const },
        ],
      };
    }

    if (targetProgress < 50 && targetProgress > 0) {
      return {
        greeting: `${timeGreeting}, ${firstName}`,
        message: `You're at ${Math.round(targetProgress)}% of your monthly target. Focus on high-value customers to accelerate your progress!`,
        type: "improvement",
        icon: <Target className="h-5 w-5 text-muted-foreground" />,
        badges: [
          { text: `${Math.round(targetProgress)}% of target`, variant: "outline" as const },
          { text: "Push harder", variant: "secondary" as const },
        ],
      };
    }

    // Neutral/encouraging
    return {
      greeting: `${timeGreeting}, ${firstName}! ✨`,
      message: `Ready to make today count? You've contacted ${customersContactedToday} customer${customersContactedToday !== 1 ? "s" : ""} so far. Keep the momentum going!`,
      type: "neutral",
      icon: <Sparkles className="h-5 w-5 text-primary" />,
      badges: callsMadeToday > 0 
        ? [{ text: `${callsMadeToday} calls today`, variant: "secondary" as const }]
        : [],
    };
  }, [
    timeGreeting,
    firstName,
    targetProgress,
    callsMadeToday,
    customersContactedToday,
    overdueCount,
    highValueOverdueCount,
    hasHighValueIssue,
    hasOverdueIssue,
    isOnTrack,
    currentHour,
  ]);

  const bgClass = useMemo(() => {
    switch (messageConfig.type) {
      case "achievement":
        return "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20";
      case "improvement":
        return "bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent border-destructive/20";
      default:
        return "bg-gradient-to-r from-muted/50 to-transparent";
    }
  }, [messageConfig.type]);

  return (
    <Card className={`${bgClass} transition-all duration-300`}>
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-full bg-background/80 shadow-sm">
            {messageConfig.icon}
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="text-lg font-semibold">{messageConfig.greeting}</h3>
            <p className="text-sm text-muted-foreground">{messageConfig.message}</p>
            {messageConfig.badges.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {messageConfig.badges.map((badge, index) => (
                  <Badge key={index} variant={badge.variant} className="text-xs">
                    {badge.text}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
