import { AppFrame } from "@/components/app-frame";
import { LanguageMenu } from "@/components/menus";
import { getI18n } from "@/lib/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { uiLocale, t } = await getI18n();
  return (
    <AppFrame>
      <div className="flex justify-end px-6 pt-4 md:px-12">
        <LanguageMenu locale={uiLocale} label={t.settings.language} soon={t.frame.preparing} compact={false} placement="down" />
      </div>
      <main className="flex-1 min-w-0 px-6 pb-8 pt-2 md:px-12">{children}</main>
    </AppFrame>
  );
}
