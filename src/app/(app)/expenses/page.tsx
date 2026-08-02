import { renderComingSoonModulePage } from "@/lib/modules/coming-soon-page";

export default async function ExpensesPage() {
  return renderComingSoonModulePage({
    moduleId: "expenses",
    title: "Expenses",
    description:
      "A dedicated expenses view is under development. You can record expenses from the Payments ledger in the meantime.",
    alternateHref: "/payments",
    alternateLabel: "Go to Payments",
  });
}
