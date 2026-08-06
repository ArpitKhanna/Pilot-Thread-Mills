"use client";

import { useEffect, useState } from "react";
import type { AppContext } from "@/app/(app)/layout";
import {
  hasActivePushSubscription,
  isPushSupported,
  subscribeToApprovalPush,
} from "@/lib/push/client";

const DISMISS_KEY = "pwa-approval-push-dismissed";

type PushNotificationSetupProps = {
  context: AppContext;
};

export function PushNotificationSetup({ context }: PushNotificationSetupProps) {
  const canReceiveApprovalPush =
    context.modules.some((module) => module.id === "approvals") &&
    isPushSupported();

  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canReceiveApprovalPush) return;

    let cancelled = false;

    async function checkState() {
      if (Notification.permission === "granted") {
        const active = await hasActivePushSubscription();
        if (!active && !cancelled) {
          const subscribed = await subscribeToApprovalPush();
          if (!subscribed && !cancelled) {
            setVisible(true);
          }
        }
        return;
      }

      if (Notification.permission === "default") {
        if (localStorage.getItem(DISMISS_KEY) === "1") return;
        if (!cancelled) setVisible(true);
      }
    }

    void checkState();

    return () => {
      cancelled = true;
    };
  }, [canReceiveApprovalPush]);

  if (!canReceiveApprovalPush || !visible) return null;

  async function enableNotifications() {
    setBusy(true);
    setError(null);
    try {
      const subscribed = await subscribeToApprovalPush();
      if (!subscribed) {
        setError(
          Notification.permission === "denied"
            ? "Notifications are blocked. Enable them in Android app settings."
            : "Could not enable notifications. Try again after reinstalling the app.",
        );
        return;
      }
      setVisible(false);
    } finally {
      setBusy(false);
    }
  }

  function dismissBanner() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="border-b border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Get a phone notification for each item that needs your approval, even
          when the app is closed.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void enableNotifications()}
            disabled={busy}
            className="rounded-lg bg-sky-700 px-3 py-1.5 font-medium text-white disabled:opacity-60"
          >
            {busy ? "Enabling…" : "Enable notifications"}
          </button>
          <button
            type="button"
            onClick={dismissBanner}
            className="rounded-lg px-2 py-1.5 text-sky-800 underline underline-offset-2"
          >
            Not now
          </button>
        </div>
      </div>
      {error ? <p className="mx-auto mt-2 max-w-3xl text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
