import { renderComingSoonModulePage } from "@/lib/modules/coming-soon-page";

export default async function PickerQueuePage() {
  return renderComingSoonModulePage({
    moduleId: "picker-queue",
    title: "Picker Queue",
  });
}
