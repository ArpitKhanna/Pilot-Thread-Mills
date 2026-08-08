"use client";

import { Button } from "@/components/ui/button";

type ModalFooterActionsProps = {
  onCancel: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  submitDisabled?: boolean;
  submitType?: "button" | "submit";
  destructive?: boolean;
  busyLabel?: string;
};

export function ModalFooterActions({
  onCancel,
  onSubmit,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  busy = false,
  submitDisabled = false,
  submitType = "button",
  destructive = false,
  busyLabel = "Saving…",
}: ModalFooterActionsProps) {
  return (
    <div className="flex w-full justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={busy}
      >
        {cancelLabel}
      </Button>
      {onSubmit ? (
        <Button
          type={submitType}
          variant={destructive ? "destructive" : "default"}
          onClick={onSubmit}
          disabled={busy || submitDisabled}
        >
          {busy ? busyLabel : submitLabel}
        </Button>
      ) : null}
    </div>
  );
}
