import webpush from "web-push";
import {
  deletePushSubscriptionByEndpoint,
  listApproverPushSubscriptions,
} from "./subscriptions";
import type { ApprovalPushPayload, PushSubscriptionRow } from "./types";
import { ensureWebPushConfigured } from "./vapid";

type NotificationPayload = {
  title: string;
  body: string;
  tag: string;
  url: string;
};

function buildNotificationPayload(
  input: ApprovalPushPayload,
): NotificationPayload {
  return {
    title: input.title,
    body: input.body,
    tag: `approval-${input.kind}-${input.entityId}`,
    url: "/approvals",
  };
}

async function sendToSubscription(
  subscription: PushSubscriptionRow,
  payload: NotificationPayload,
): Promise<void> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
    );
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : undefined;

    if (statusCode === 404 || statusCode === 410) {
      await deletePushSubscriptionByEndpoint(subscription.endpoint);
      return;
    }

    throw error;
  }
}

/** Send one push notification per approver device for a single pending approval. */
export async function sendApprovalPush(
  input: ApprovalPushPayload,
): Promise<void> {
  if (!ensureWebPushConfigured()) {
    console.warn(
      "Push notifications skipped: set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
    );
    return;
  }

  const subscriptions = await listApproverPushSubscriptions(input.excludeUserId);
  if (subscriptions.length === 0) return;

  const payload = buildNotificationPayload(input);
  const results = await Promise.allSettled(
    subscriptions.map((subscription) => sendToSubscription(subscription, payload)),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Failed to send approval push:", result.reason);
    }
  }
}
