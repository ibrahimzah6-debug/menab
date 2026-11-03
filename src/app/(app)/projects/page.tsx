import { Later } from "@/components/later";
import { getI18n } from "@/lib/i18n/server";

export default async function Page() {
  const { t } = await getI18n();
  return <Later title={t.nav.projects} />;
}
