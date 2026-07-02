import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/AppShell";
import { getAppContext } from "@/app/(app)/layout";

export default async function PaymentsPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");
  return (
    <>
      <TopBar context={context} breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Payments" }]} />
      <main className="flex flex-1 items-center justify-center px-8 py-16 text-center">
        <div>
          <h1 className="text-2xl font-medium">Payments</h1>
          <p className="mt-2 text-sm text-muted">Coming in a future release</p>
        </div>
      </main>
    </>
  );
}
