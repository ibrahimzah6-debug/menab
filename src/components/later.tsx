import { getI18n } from "@/lib/i18n/server";

export async function Later({ title }: { title: string }) {
  const { t } = await getI18n();
  return (
    <div className="max-w-[880px]">
      <h1 className="h1 m-0 mb-6">{title}</h1>
      <div className="bg-surface border border-line rounded-lg p-6">
        <p className="body text-ink-muted m-0">{t.later.body}</p>
      </div>
    </div>
  );
}
