import { useLocation } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

const KNOWN_ROUTES = new Set([
  "/",
  "/users",
  "/settings",
  "/hr",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/install",
]);

const NotFound = () => {
  const location = useLocation();
  const [isReloading, setIsReloading] = useState(false);

  const looksLikeKnownRoute = useMemo(() => {
    // Helpful for cases where a stale cached build is loaded and the router doesn't know newer routes yet
    if (KNOWN_ROUTES.has(location.pathname)) return true;
    if (location.pathname.startsWith("/hr/")) return true;
    return false;
  }, [location.pathname]);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const handleReloadApp = useCallback(async () => {
    setIsReloading(true);

    try {
      // Clear SW + Cache Storage to recover from stale builds (safe no-op if not present)
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {
      // Even if cleanup fails, a reload often fixes transient routing issues
      console.warn("NotFound reload cleanup failed", e);
    } finally {
      window.location.reload();
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center max-w-md px-4">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>

        {looksLikeKnownRoute && (
          <div className="mb-5 text-sm text-muted-foreground">
            This page exists, but your app may have loaded an older cached version. Try reloading the app.
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="/" className="text-primary underline hover:text-primary/90">
            Return to Home
          </a>
          {looksLikeKnownRoute && (
            <Button variant="outline" onClick={handleReloadApp} disabled={isReloading}>
              {isReloading ? "Reloading..." : "Reload app"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
