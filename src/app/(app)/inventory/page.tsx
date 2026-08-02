import { renderComingSoonModulePage } from "@/lib/modules/coming-soon-page";

export default async function InventoryPage() {
  return renderComingSoonModulePage({
    moduleId: "inventory",
    title: "Inventory",
  });
}
