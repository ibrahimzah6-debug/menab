import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

// A page of the website that is not written yet. Every link on the site leads somewhere.
export default async function SoonPage() {
  const { t, dir } = await getI18n();
  const c = t.site.soon;
  return (
    <div data-theme="dark" dir={dir} style={{ background: "var(--ground)", color: "var(--ink)", minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "var(--font-sans)" }}>
      <div className="flex flex-col items-center gap-5 text-center" style={{ maxWidth: 520 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/menab-mark-light.png" alt="" style={{ width: 48 }} />
        <h1 className="h1 m-0" dir="auto">{c.title}</h1>
        <p className="body m-0" style={{ color: "var(--ink-muted)" }} dir="auto">{c.text}</p>
        <div className="flex flex-wrap gap-2 justify-center">
          <a href="mailto:hello@menab.si" className="site-btn site-btn--primary">{c.contact}</a>
          <Link href="/" className="site-btn site-btn--line">{c.back}</Link>
        </div>
      </div>
    </div>
  );
}
