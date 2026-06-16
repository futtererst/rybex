import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/d5o/ModulePlaceholder";
import { moduleMap, rybexModules } from "@/lib/d5o/modules";

type ModulePageProps = {
  params: Promise<{
    module: string;
  }>;
};

export function generateStaticParams() {
  return rybexModules
    .filter((moduleConfig) =>
      !["pipeline", "projects", "mobilization", "field-execution", "safety", "quality", "rfis-submittals", "changes", "billing", "closeout", "reports", "admin"].includes(moduleConfig.slug)
    )
    .map((moduleConfig) => ({
      module: moduleConfig.slug
    }));
}

export async function generateMetadata({ params }: ModulePageProps) {
  const { module: slug } = await params;
  const moduleConfig = moduleMap[slug];

  return {
    title: moduleConfig ? `${moduleConfig.label} | RybexOS` : "RybexOS"
  };
}

export default async function ModulePage({ params }: ModulePageProps) {
  const { module: slug } = await params;
  const moduleConfig = moduleMap[slug];

  if (!moduleConfig) {
    notFound();
  }

  return <ModulePlaceholder module={moduleConfig} />;
}
