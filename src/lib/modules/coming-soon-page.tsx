import { redirect } from "next/navigation";
import { getAppContext } from "@/app/(app)/layout";
import { ComingSoonPage } from "@/components/layout/ComingSoonPage";

type ComingSoonModulePageOptions = {
  moduleId: string;
  title: string;
  description?: string;
  alternateHref?: string;
  alternateLabel?: string;
};

export async function renderComingSoonModulePage({
  moduleId,
  title,
  description,
  alternateHref,
  alternateLabel,
}: ComingSoonModulePageOptions) {
  const context = await getAppContext();
  if (!context) redirect("/login");

  const hasAccess = context.modules.some((m) => m.id === moduleId);
  if (!hasAccess) redirect("/dashboard");

  return (
    <ComingSoonPage
      context={context}
      title={title}
      description={description}
      alternateHref={alternateHref}
      alternateLabel={alternateLabel}
    />
  );
}
