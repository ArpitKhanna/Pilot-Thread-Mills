import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/AppShell";
import { getAppContext } from "@/app/(app)/layout";
import { ITEM_TYPE_LABELS, type ItemType, type PriceListItem } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const isAdmin = context.profile.role === "admin";
  let pendingItems: PriceListItem[] = [];

  if (isAdmin) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("price_list_items")
      .select("*")
      .eq("status", "pending_approval")
      .order("created_at", { ascending: false })
      .limit(10);
    pendingItems = (data ?? []) as PriceListItem[];
  }

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]}
      />
      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
            Welcome, {context.profile.full_name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Your operations hub for Pilot Thread Mills
          </p>
        </div>

        {isAdmin && pendingItems.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-medium">Approval Queue</h2>
                <p className="text-sm text-muted">
                  Price list items submitted by accountants awaiting your review
                </p>
              </div>
              <Link
                href="/entities/price-list"
                className="text-sm font-medium underline underline-offset-2"
              >
                View all
              </Link>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {pendingItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <p className="font-medium">{item.item_name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {ITEM_TYPE_LABELS[item.item_type as ItemType]}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    ₹{item.salesmen_price} / ₹{item.customer_price}
                  </p>
                </div>
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-table-header">
                    <th className="px-5 py-3 text-left font-mono text-[11px] font-medium tracking-wider text-muted uppercase">
                      Item
                    </th>
                    <th className="px-5 py-3 text-left font-mono text-[11px] font-medium tracking-wider text-muted uppercase">
                      Type
                    </th>
                    <th className="px-5 py-3 text-left font-mono text-[11px] font-medium tracking-wider text-muted uppercase">
                      Prices
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 font-medium">{item.item_name}</td>
                      <td className="px-5 py-3 text-muted">
                        {ITEM_TYPE_LABELS[item.item_type as ItemType]}
                      </td>
                      <td className="px-5 py-3 text-muted">
                        ₹{item.salesmen_price} / ₹{item.customer_price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-lg font-medium">Quick access</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {context.modules
              .filter((m) => m.id !== "dashboard")
              .slice(0, 6)
              .map((module) => (
                <Link
                  key={module.id}
                  href={module.href}
                  className="rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:border-foreground/20"
                >
                  <h3 className="font-medium">{module.name}</h3>
                  <p className="mt-1 text-sm text-muted">Open module</p>
                </Link>
              ))}
          </div>
        </section>
      </main>
    </>
  );
}
