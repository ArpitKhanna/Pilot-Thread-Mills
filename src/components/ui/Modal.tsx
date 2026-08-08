"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Wider dialog for multi-step / denser forms. Default "md". */
  size?: "md" | "lg" | "xl" | "2xl";
  /** Extra classes for the scrollable body (e.g. flush split layouts). */
  bodyClassName?: string;
};

const SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  "2xl": "sm:max-w-6xl",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  bodyClassName,
}: ModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        showCloseButton
        className={cn(
          "flex max-h-[92dvh] w-full max-w-[calc(100%-0px)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh]",
          "top-auto bottom-0 translate-x-[-50%] translate-y-0 rounded-t-2xl rounded-b-none",
          "sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:rounded-xl",
          "bg-surface ring-border",
          SIZE_CLASS[size],
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-4 sm:px-6">
          <DialogTitle className="text-left text-lg font-medium">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div
          className={
            bodyClassName ??
            "flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
          }
        >
          {children}
        </div>

        {footer ? (
          <div className="flex shrink-0 justify-end border-t border-border px-4 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
