/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

type PushPayload = {
  title: string;
  body: string;
  tag: string;
  url?: string;
};

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag,
      data: { url: payload.url ?? "/approvals" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    typeof event.notification.data?.url === "string"
      ? event.notification.data.url
      : "/approvals";
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (!("focus" in client)) continue;
          const windowClient = client as WindowClient;
          if (windowClient.url.startsWith(self.location.origin)) {
            void windowClient.navigate(absoluteUrl);
            return windowClient.focus();
          }
        }
        return self.clients.openWindow(absoluteUrl);
      }),
  );
});

export {};
