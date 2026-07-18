import { notFound, redirect } from "next/navigation";
import { SalesmanDetailClient } from "@/components/salesmen/SalesmanDetailClient";
import { getAppContext } from "@/app/(app)/layout";
import {
  getSalesman,
  listInvoicesForSalesman,
} from "@/lib/salesmen/queries";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SalesmanDetailPage({ params }: PageProps) {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "entity-salesmen");
  if (!hasAccess) redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();
  const salesman = await getSalesman(supabase, id);
  if (!salesman) notFound();

  const invoices = await listInvoicesForSalesman(supabase, id);

  return (
    <SalesmanDetailClient
      context={context}
      initialSalesman={salesman}
      initialInvoices={invoices}
    />
  );
}
