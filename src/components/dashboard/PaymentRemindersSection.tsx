"use client";

import { MotionCard } from "@/components/ui/motion";

export function PaymentRemindersSection() {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-medium sm:text-lg">Payment reminders</h2>
      </div>

      <MotionCard
        interactive={false}
        className="rounded-xl border border-dashed border-border bg-sidebar/40 px-4 py-8 text-center"
      >
        <p className="text-sm font-medium text-foreground">
          No recurring payments yet
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          Scheduled and recurring payments will show up here once you add them
          from the Expenses tab.
        </p>
      </MotionCard>
    </section>
  );
}
