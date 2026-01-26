import { useEffect, memo } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * ScreenProtection Component
 * Implements multiple layers of screenshot deterrents:
 * 1. Disables right-click context menu
 * 2. Disables keyboard shortcuts (PrintScreen, Ctrl+P, Ctrl+S, etc.)
 * 3. Disables text selection and copying
 * 4. Blurs screen when tab loses focus
 * 5. Displays user watermark for traceability
 * 
 * Note: True screenshot prevention is impossible in browsers,
 * but these measures create strong deterrents.
 */

interface ScreenProtectionProps {
  children: React.ReactNode;
}

export const ScreenProtection = memo(({ children }: ScreenProtectionProps) => {
  const { user } = useAuth();

  useEffect(() => {
    // Prevent right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Prevent keyboard shortcuts for screenshots and copying
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key
      if (e.key === "PrintScreen") {
        e.preventDefault();
        navigator.clipboard.writeText("").catch(() => {});
        return false;
      }

      // Ctrl/Cmd + P (Print)
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        return false;
      }

      // Ctrl/Cmd + S (Save)
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        return false;
      }

      // Ctrl/Cmd + C (Copy)
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        return false;
      }

      // Ctrl/Cmd + Shift + S (Screenshot on some systems)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "s") {
        e.preventDefault();
        return false;
      }

      // Windows + Shift + S (Windows screenshot)
      if (e.metaKey && e.shiftKey && e.key === "s") {
        e.preventDefault();
        return false;
      }

      // F12 (DevTools)
      if (e.key === "F12") {
        e.preventDefault();
        return false;
      }

      // Ctrl/Cmd + Shift + I (DevTools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "i") {
        e.preventDefault();
        return false;
      }

      // Ctrl/Cmd + U (View Source)
      if ((e.ctrlKey || e.metaKey) && e.key === "u") {
        e.preventDefault();
        return false;
      }
    };

    // Prevent copy event
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      return false;
    };

    // Prevent cut event
    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      return false;
    };

    // Prevent drag start
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    // Blur content when tab loses focus (visibility change)
    const handleVisibilityChange = () => {
      const appRoot = document.getElementById("root");
      if (appRoot) {
        if (document.hidden) {
          appRoot.style.filter = "blur(20px)";
          appRoot.style.pointerEvents = "none";
        } else {
          appRoot.style.filter = "none";
          appRoot.style.pointerEvents = "auto";
        }
      }
    };

    // Blur on window blur (when switching apps)
    const handleWindowBlur = () => {
      const appRoot = document.getElementById("root");
      if (appRoot) {
        appRoot.style.filter = "blur(20px)";
        appRoot.style.pointerEvents = "none";
      }
    };

    const handleWindowFocus = () => {
      const appRoot = document.getElementById("root");
      if (appRoot) {
        appRoot.style.filter = "none";
        appRoot.style.pointerEvents = "auto";
      }
    };

    // Add all event listeners
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    // Cleanup
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  return (
    <div className="relative min-h-screen select-none">
      {/* Watermark overlay */}
      <div 
        className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-32 -rotate-12 opacity-[0.03]">
          {Array.from({ length: 20 }).map((_, i) => (
            <span
              key={i}
              className="whitespace-nowrap text-2xl font-bold text-foreground"
            >
              {user?.email || "Suvee Fashion CRM"}
            </span>
          ))}
        </div>
      </div>
      
      {/* Main content */}
      {children}
    </div>
  );
});

ScreenProtection.displayName = "ScreenProtection";
