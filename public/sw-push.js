// Custom service worker additions for push notifications
// This file will be injected into the generated service worker

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || "You have a new notification",
      icon: data.icon || "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      vibrate: [100, 50, 100],
      data: {
        url: data.url || "/",
        dateOfArrival: Date.now(),
      },
      actions: [
        {
          action: "open",
          title: "Open App",
        },
        {
          action: "dismiss",
          title: "Dismiss",
        },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "Suvee CRM", options)
    );
  } catch (error) {
    console.error("Error handling push event:", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there is already a window/tab open with the target URL
        for (let client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            if (client.navigate) {
              client.navigate(urlToOpen);
            }
            return;
          }
        }
        // If not, open a new window/tab
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle background sync for offline actions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-interactions") {
    // Handle syncing offline interactions when back online
    console.log("Background sync triggered");
  }
});
