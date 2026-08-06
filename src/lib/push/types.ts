export type ApprovalPushKind = "invoice" | "advance" | "return" | "price_list";

export type ApprovalPushPayload = {
  kind: ApprovalPushKind;
  entityId: string;
  excludeUserId: string;
  title: string;
  body: string;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type ClientPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};
