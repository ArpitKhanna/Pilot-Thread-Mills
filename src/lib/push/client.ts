"use client";

import type { ClientPushSubscription } from "./types";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Phone/tablet targets — skip desktop browsers and installed desktop PWAs. */
export function isMobilePushTarget(): boolean {
  if (typeof window === "undefined") return false;

  const coarseTouch = window.matchMedia(
    "(hover: none) and (pointer: coarse)",
  ).matches;
  const mobileUserAgent = /Android|iPhone|iPod/i.test(navigator.userAgent);

  return coarseTouch || mobileUserAgent;
}

export function canUseApprovalPush(): boolean {
  return isPushSupported() && isMobilePushTarget();
}

async function ensurePushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;

  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing?.active?.scriptURL.includes("push-sw.js")) {
    return existing;
  }

  return navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
}

export async function fetchVapidPublicKey(): Promise<string | null> {
  const res = await fetch("/api/push/vapid-public-key");
  if (!res.ok) return null;
  const data = (await res.json()) as { publicKey?: string };
  return data.publicKey ?? null;
}

function serializeSubscription(
  subscription: PushSubscription,
): ClientPushSubscription {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("Invalid push subscription");
  }
  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}

export async function subscribeToApprovalPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) return false;

  const registration = await ensurePushServiceWorker();
  if (!registration) return false;

  await navigator.serviceWorker.ready;
  const activeRegistration =
    (await navigator.serviceWorker.getRegistration("/")) ?? registration;
  let subscription = await activeRegistration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await activeRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(serializeSubscription(subscription)),
  });

  return res.ok;
}

export async function unsubscribeFromApprovalPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return true;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const res = await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });

  return res.ok;
}

export async function hasActivePushSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (Notification.permission !== "granted") return false;

  const registration =
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await ensurePushServiceWorker());
  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();
  return Boolean(subscription);
}
