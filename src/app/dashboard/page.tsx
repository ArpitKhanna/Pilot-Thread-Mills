import { redirect } from "next/navigation";
import { formatPhoneDisplay } from "@/lib/auth/phone";
import type { Profile } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  const modules = [
    {
      title: "Production",
      description: "Track spinning, winding, and finishing stages.",
      status: "Coming in v1.1",
    },
    {
      title: "Inventory",
      description: "Raw material stock and finished thread lots.",
      status: "Coming in v1.1",
    },
    {
      title: "Orders",
      description: "Customer orders and dispatch scheduling.",
      status: "Coming in v1.2",
    },
    {
      title: "Employees",
      description: "Manage team access, roles, and PINs.",
      status: profile?.role === "admin" ? "Available" : "Admin only",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-sky-700">
            Pilot Thread Mills
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Welcome, {profile?.full_name ?? "Team member"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {profile?.phone ? formatPhoneDisplay(profile.phone) : ""}
            {profile?.role ? ` · ${profile.role}` : ""}
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Sign out
          </button>
        </form>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Modules</h2>
        <p className="mt-1 text-sm text-slate-600">
          v1 mirrors your current shop-floor flow. Modules unlock as we digitize
          each step.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {modules.map((module) => (
            <article
              key={module.title}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-slate-900">{module.title}</h3>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {module.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{module.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
