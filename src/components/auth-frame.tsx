import { Logo } from "./logo";
import { LangSwitch } from "./lang-switch";
import { getI18n } from "@/lib/i18n/server";

// Centered card used by login and set password.
export async function AuthFrame({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getI18n();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-3.5">
        <Logo height={22} />
        <LangSwitch to={locale === "ar" ? "en" : "ar"} label={t.langSwitch} ariaLabel={t.langSwitchLabel} />
      </header>
      <main className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[400px] bg-surface border border-line rounded-lg p-8">{children}</div>
      </main>
    </div>
  );
}
