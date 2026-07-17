import { redirect } from "next/navigation";
import { SalesmenListClient } from "@/components/salesmen/SalesmenListClient";
import { getAppContext } from "@/app/(app)/layout";

export default async function SalesmenPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "entity-salesmen");
  if (!hasAccess) redirect("/dashboard");

  return <SalesmenListClient context={context} />;
}
