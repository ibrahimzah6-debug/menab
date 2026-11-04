import { ProjectList } from "@/components/project-list";
import { getI18n } from "@/lib/i18n/server";

export default async function ProjectsPage() {
  const { t } = await getI18n();
  return (
    <div className="max-w-[1100px] flex flex-col gap-5">
      <h1 className="h1 m-0">{t.projects.title}</h1>
      <ProjectList />
    </div>
  );
}
