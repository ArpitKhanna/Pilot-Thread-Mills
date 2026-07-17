import { notFound, redirect } from "next/navigation";
import { SalesmanDetailClient } from "@/components/salesmen/SalesmanDetailClient";
import { getAppContext } from "@/app/(app)/layout";
import { getSalesmanById } from "@/lib/salesmen/mock-data";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SalesmanDetailPage({ params }: PageProps) {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === "entity-salesmen");
  if (!hasAccess) redirect("/dashboard");

  const { id } = await params;
  const salesman = getSalesmanById(id);
  if (!salesman) notFound();

  return (
    <SalesmanDetailClient context={context} initialSalesman={salesman} />
  );
}
