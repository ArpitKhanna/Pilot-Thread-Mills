"use client";

import type { AppContext } from "@/app/(app)/layout";
import { CreateFab } from "./CreateFab";

type CreateFabHostProps = {
  context: AppContext;
};

function hasModule(context: AppContext, ids: string[]): boolean {
  const set = new Set(context.modules.map((m) => m.id));
  return ids.some((id) => set.has(id));
}

export function CreateFabHost({ context }: CreateFabHostProps) {
  return (
    <CreateFab
      canAddReceipt={hasModule(context, [
        "entity-salesmen",
        "order-salesmen",
        "entity-customers",
        "order-customers",
        "dashboard",
        "payments",
      ])}
      canAddPayment={hasModule(context, [
        "expenses",
        "dashboard",
        "payments",
      ])}
      canCreateOrder={hasModule(context, ["order-customers"])}
      canCreateCustomerInvoice={hasModule(context, [
        "order-customers",
        "entity-customers",
      ])}
      canCreateSalesmenInvoice={hasModule(context, ["order-salesmen"])}
      canCreateDyeingOrder={hasModule(context, [
        "order-customers",
        "dyeing-jobs",
      ])}
    />
  );
}
