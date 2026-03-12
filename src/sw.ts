/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{
    url: string;
    revision?: string | null;
  }>;
};

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event) => {
  let data: {
    title?: string;
    body?: string;
    url?: string;
    icon?: string;
    badge?: string;
    tag?: string;
  } = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "VaFood",
      body: "Tenés una nueva notificación.",
      url: "/",
    };
  }

  const title = data.title || "VaFood";
  const body = data.body || "Tenés una nueva notificación.";
  const url = data.url || "/";
  const icon = data.icon || "/image.png";
  const badge = data.badge || "/image.png";
  const tag = data.tag || `notif-${Date.now()}`;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      renotify: true,
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const win = client as WindowClient;

        if ("focus" in win) {
          try {
            win.navigate(targetUrl);
          } catch {
            // noop
          }
          return win.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
