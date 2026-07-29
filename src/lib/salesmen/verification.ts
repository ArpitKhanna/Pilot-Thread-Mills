import type { InvoiceVerificationStatus } from "./types";

export type VerificationActor = {
  id: string;
  full_name: string;
  role: string | null;
};

export type VerificationInsert = {
  verification_status: InvoiceVerificationStatus;
  created_by: string;
  created_by_name: string;
  verified_by: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
  verification_note: string | null;
};

export function actorDisplayName(actor: VerificationActor): string {
  const name = actor.full_name?.trim();
  return name || "Unknown";
}

/** Admin creates → auto-verified; anyone else → pending admin verification */
export function verificationForCreator(
  actor: VerificationActor,
): VerificationInsert {
  const name = actorDisplayName(actor);
  if (actor.role === "admin") {
    const now = new Date().toISOString();
    return {
      verification_status: "verified",
      created_by: actor.id,
      created_by_name: name,
      verified_by: actor.id,
      verified_by_name: name,
      verified_at: now,
      verification_note: null,
    };
  }
  return {
    verification_status: "pending_verification",
    created_by: actor.id,
    created_by_name: name,
    verified_by: null,
    verified_by_name: null,
    verified_at: null,
    verification_note: null,
  };
}

/** After accountant edits a pending/needs_edit invoice, re-queue for admin */
export function verificationForResubmit(
  actor: VerificationActor,
  existingCreatedBy: string | null | undefined,
  existingCreatedByName: string | null | undefined,
): VerificationInsert {
  const creatorId = existingCreatedBy ?? actor.id;
  const creatorName =
    existingCreatedByName?.trim() || actorDisplayName(actor);
  return {
    verification_status: "pending_verification",
    created_by: creatorId,
    created_by_name: creatorName,
    verified_by: null,
    verified_by_name: null,
    verified_at: null,
    verification_note: null,
  };
}

export function paymentVerificationFields(v: VerificationInsert) {
  return {
    verification_status: v.verification_status,
    created_by: v.created_by,
    created_by_name: v.created_by_name,
    verified_by: v.verified_by,
    verified_by_name: v.verified_by_name,
    verified_at: v.verified_at,
  };
}

export type AttributionFields = {
  verificationStatus: InvoiceVerificationStatus;
  createdByName?: string | null;
  verifiedByName?: string | null;
  verificationNote?: string | null;
  /** Prefer verified_at when present for verified items */
  at?: string | null;
};

export function formatVerificationAttribution(
  fields: AttributionFields,
): string {
  const creator = fields.createdByName?.trim() || "Unknown";
  if (fields.verificationStatus === "pending_verification") {
    return `Created by @${creator}, verification pending by admin`;
  }
  if (fields.verificationStatus === "needs_edit") {
    return `Created by @${creator}, sent back for editing`;
  }
  const verifier = fields.verifiedByName?.trim();
  if (verifier && verifier !== creator) {
    return `Created by @${creator}, verified by @${verifier}`;
  }
  return `Created and Verified by @${creator}`;
}

export type VerificationLogContent = {
  message: string;
  createdByName: string;
  verifiedByName: string | null;
  at: string | null;
  note: string | null;
};

/** Message + actors for the Activity Timeline–style log card */
export function verificationLogContent(
  fields: AttributionFields,
  kind: "invoice" | "payment" = "invoice",
): VerificationLogContent {
  const subject = kind === "payment" ? "Payment" : "Invoice";
  const creator = fields.createdByName?.trim() || "Unknown";
  const verifier = fields.verifiedByName?.trim() || null;
  const note = fields.verificationNote?.trim() || null;

  let message: string;
  if (fields.verificationStatus === "pending_verification") {
    message = `${subject} was created · Pending verification.`;
  } else if (fields.verificationStatus === "needs_edit") {
    message = note
      ? `${subject} was sent back for editing. ${note}`
      : `${subject} was sent back for editing.`;
  } else if (verifier && verifier === creator) {
    message = `${subject} was created and verified.`;
  } else if (verifier) {
    message = `${subject} was created and verified.`;
  } else {
    message = `${subject} was created.`;
  }

  return {
    message,
    createdByName: creator,
    verifiedByName:
      verifier && verifier !== creator ? verifier : null,
    at: fields.at ?? null,
    note: null,
  };
}

export function formatRelativeVerificationTime(iso: string | null): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(then).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function verificationStatusLabel(
  status: InvoiceVerificationStatus,
): string | null {
  if (status === "pending_verification") return "Pending";
  if (status === "needs_edit") return "Needs edit";
  return null;
}
