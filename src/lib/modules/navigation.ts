import type { AppModule, EmployeeRole } from "@/lib/auth/types";

export const MODULE_ICONS: Record<string, string> = {
  dashboard: "grid",
  payments: "wallet",
  expenses: "receipt",
  inventory: "package",
  "picker-queue": "list-checks",
  "dyeing-jobs": "palette",
  "order-customers": "users",
  "order-salesmen": "briefcase",
  "entity-customers": "users",
  "entity-salesmen": "briefcase",
  "bank-accounts": "landmark",
  "price-list": "tags",
  "employees-roles": "shield",
};

export const SECTION_LABELS: Record<AppModule["section"], string> = {
  overview: "Overview",
  orders: "Orders",
  entities: "Entities",
};

export function groupModulesBySection(modules: AppModule[]) {
  const sections: AppModule["section"][] = ["overview", "orders", "entities"];
  return sections.map((section) => ({
    section,
    label: SECTION_LABELS[section],
    items: modules
      .filter((m) => m.section === section)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export function canAccessModule(
  role: EmployeeRole | null,
  moduleId: string,
  accessList: { role: EmployeeRole; module_id: string }[],
): boolean {
  if (!role) return false;
  return accessList.some((a) => a.role === role && a.module_id === moduleId);
}
