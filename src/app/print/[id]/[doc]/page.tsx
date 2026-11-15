import { notFound } from "next/navigation";
import { findTerm, type TermKind } from "@/lib/film-terms";
import { loadDeck, type Brand, type DeckCharacter, type DeckFrame, type DeckLocation } from "@/lib/deck";
import { fill, type Dictionary } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { PrintBar } from "./print-bar";

// A branded document as 16:9 pages, saved as PDF from the browser's print window. The layout is
// designed once per document type; the AI only fills the content. The company's brand kit gives
// the logo and the accent colour; without one, the neutral Menab kit is used.

const W = 1280;
const H = 720;

export async function generateMetadata({ params }: { params: Promise<{ id: string; doc: string }> }) {
  const { doc } = await params;
  return { title: doc === "storyboard" ? "Storyboard" : "Look book" };
}

export default async function PrintPage({ params }: { params: Promise<{ id: string; doc: string }> }) {
  const { id, doc } = await params;
  if (doc !== "look-book" && doc !== "storyboard") notFound();
  const deck = await loadDeck(id);
  if (!deck) notFound();
  const { t, locale, dir } = await getI18n();
  const d = t.deck;
  const lang = locale === "ar" ? "ar" : "en";
  const term = (kind: TermKind, v: string) => findTerm(kind, v)?.[lang] ?? v;
  const date = new Date().toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" });
  const title = doc === "storyboard" ? d.storyboard : d.lookBook;
  const b = deck.brand;

  const pages: React.ReactNode[] = [];
  const cover = [...deck.characters.map((c) => c.picture), ...deck.storyboard.map((f) => f.picture), ...deck.locations.map((l) => l.picture)].filter(Boolean) as string[];
  pages.push(<Cover key="cover" brand={b} title={title} project={deck.project.name} client={deck.project.client} date={date} pictures={doc === "storyboard" ? deck.storyboard.map((f) => f.picture).filter(Boolean) as string[] : cover} d={d} />);

  if (doc === "look-book") {
    if (deck.characters.length) {
      pages.push(<Divider key="dc" brand={b} label={d.characters} count={deck.characters.length} />);
      deck.characters.forEach((c, i) => pages.push(<CharacterPage key={`c${i}`} c={c} i={i} total={deck.characters.length} brand={b} t={t} term={term} />));
    }
    if (deck.locations.length) {
      pages.push(<Divider key="dl" brand={b} label={d.locations} count={deck.locations.length} />);
      deck.locations.forEach((l, i) => pages.push(<LocationPage key={`l${i}`} l={l} i={i} total={deck.locations.length} brand={b} t={t} term={term} />));
    }
  } else {
    const per = 6;
    for (let i = 0; i < deck.storyboard.length; i += per) {
      pages.push(<StoryboardPage key={`s${i}`} frames={deck.storyboard.slice(i, i + per)} brand={b} project={deck.project.name} d={d} term={term} page={i / per + 1} pages={Math.ceil(deck.storyboard.length / per)} />);
    }
  }
  const empty = pages.length === 1;

  return (
    <div dir={dir} lang={lang} style={{ background: "#E9E7E3", minHeight: "100vh", color: b.ink }}>
      <style>{`
        @page { size: ${W}px ${H}px; margin: 0; }
        @media print {
          html, body { background: none !important; }
          .no-print { display: none !important; }
          .sheet { margin: 0 !important; box-shadow: none !important; }
          .sheets { padding: 0 !important; gap: 0 !important; }
        }
        .sheet { width: ${W}px; height: ${H}px; position: relative; overflow: hidden; break-after: page; page-break-after: always; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .sheet:last-of-type { break-after: auto; page-break-after: auto; }
        .bidi { unicode-bidi: plaintext; }
        [dir="rtl"] .bidi { text-align: right; }
        [dir="ltr"] .bidi { text-align: left; }
        .mono { font-family: "JetBrains Mono", ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; }
        [lang="ar"] .mono { font-family: inherit; letter-spacing: 0; text-transform: none; }
        .clamp { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
      <PrintBar label={d.savePdf} back={d.back} tip={d.tip} href={`/p/${id}?o=${doc === "storyboard" ? 17 : 13}`} />
      <div className="sheets" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "24px 0 48px" }}>
        {pages}
        {empty && <p className="no-print" style={{ fontSize: 15 }}>{d.empty}</p>}
      </div>
    </div>
  );
}

function Sheet({ brand, children, style }: { brand: Brand; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section className="sheet" style={{ background: brand.paper, boxShadow: "0 8px 30px rgba(0,0,0,.12)", ...style }}>
      {children}
    </section>
  );
}

function Logo({ brand, light }: { brand: Brand; light?: boolean }) {
  if (brand.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.logo} alt={brand.name} style={{ height: 36, maxWidth: 200, objectFit: "contain" }} />;
  }
  return <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: light ? "#fff" : brand.ink }}>{brand.name}</span>;
}

function Footer({ brand, left, right }: { brand: Brand; left: string; right?: string }) {
  return (
    <div className="mono" style={{ position: "absolute", insetInline: 48, bottom: 22, display: "flex", justifyContent: "space-between", fontSize: 10, color: "#7A7774" }}>
      <span>{left}</span>
      <span>{right ?? (brand.isMenab ? "Menab" : "")}</span>
    </div>
  );
}

function Cover({ brand, title, project, client, date, pictures, d }: { brand: Brand; title: string; project: string; client: string | null; date: string; pictures: string[]; d: Dictionary["deck"] }) {
  const pics = pictures.slice(0, 3);
  return (
    <Sheet brand={brand}>
      <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: pics.length ? "1fr 1fr" : "1fr" }}>
        <div style={{ padding: "48px 56px", display: "flex", flexDirection: "column" }}>
          <Logo brand={brand} />
          <div style={{ marginTop: "auto", borderInlineStart: `6px solid ${brand.accent}`, paddingInlineStart: 28 }}>
            <div className="mono" style={{ fontSize: 13, color: "#7A7774" }}>{title}</div>
            <h1 className="bidi" style={{ fontSize: 60, lineHeight: 1.05, fontWeight: 600, margin: "14px 0 0", letterSpacing: "-0.01em" }}>{project}</h1>
            {client && <p className="bidi" style={{ fontSize: 20, margin: "16px 0 0", color: "#4A4744" }}>{fill(d.preparedFor, { client })}</p>}
          </div>
          <div className="mono" style={{ marginTop: 48, fontSize: 11, color: "#7A7774", display: "flex", gap: 24 }}>
            <span>{date}</span>
            {brand.isMenab && <span>{d.madeWith}</span>}
          </div>
        </div>
        {pics.length > 0 && (
          <div style={{ display: "grid", gridTemplateRows: pics.length === 1 ? "1fr" : pics.length === 2 ? "1fr 1fr" : "3fr 2fr", gridTemplateColumns: pics.length === 3 ? "1fr 1fr" : "1fr", gap: 6, background: brand.paper }}>
            {pics.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", gridColumn: pics.length === 3 && i === 0 ? "1 / span 2" : undefined }} />
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Divider({ brand, label, count }: { brand: Brand; label: string; count: number }) {
  return (
    <Sheet brand={brand} style={{ background: brand.isMenab ? "#141414" : brand.accent, color: "#fff" }}>
      <div style={{ position: "absolute", insetInline: 56, top: 48 }}><Logo brand={brand} light /></div>
      <div style={{ position: "absolute", insetInline: 56, bottom: 64 }}>
        <div className="mono" style={{ fontSize: 14, opacity: 0.7 }}>{String(count).padStart(2, "0")}</div>
        <h2 style={{ fontSize: 72, fontWeight: 600, margin: "8px 0 0", lineHeight: 1 }}>{label}</h2>
      </div>
    </Sheet>
  );
}

function Picture({ src, name }: { src: string | null; name: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
  }
  return (
    <div style={{ width: "100%", height: "100%", background: "#EFEDEA", display: "grid", placeItems: "center" }}>
      <span style={{ fontSize: 160, fontWeight: 600, color: "#DAD6D1" }}>{name.trim().charAt(0)}</span>
    </div>
  );
}

function Field({ label, children, lines = 3 }: { label: string; children: React.ReactNode; lines?: number }) {
  if (!children) return null;
  return (
    <div>
      <div className="mono" style={{ fontSize: 10, color: "#7A7774", marginBottom: 4 }}>{label}</div>
      <div className="clamp bidi" style={{ fontSize: 14, lineHeight: 1.45, WebkitLineClamp: lines }}>{children}</div>
    </div>
  );
}

function CharacterPage({ c, i, total, brand, t, term }: { c: DeckCharacter; i: number; total: number; brand: Brand; t: Dictionary; term: (k: TermKind, v: string) => string }) {
  const k = t.look.characters;
  return (
    <Sheet brand={brand}>
      <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "560px 1fr" }}>
        <Picture src={c.picture} name={c.name} />
        <div style={{ padding: "44px 52px 56px", display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 11, color: "#7A7774", display: "flex", justifyContent: "space-between" }}>
            <span>{t.deck.character} {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
            <span style={{ color: brand.accent }}>{term("castMade", c.made_with)}</span>
          </div>
          <div>
            <h2 className="bidi" style={{ fontSize: 40, fontWeight: 600, margin: 0, lineHeight: 1.1 }}>{c.name}</h2>
            <p className="bidi" style={{ fontSize: 16, color: "#4A4744", margin: "6px 0 0" }}>{c.role}{c.age ? ` · ${c.age}` : ""}</p>
          </div>
          <div style={{ height: 2, width: 48, background: brand.accent }} />
          <Field label={k.look} lines={4}>{c.look}</Field>
          <Field label={k.personality} lines={2}>{c.personality}</Field>
          {c.wardrobe.length > 0 && (
            <Field label={t.outputs[14]} lines={4}>
              {c.wardrobe.slice(0, 3).map((w) => `${w.scene}: ${w.outfit}`).join(" · ")}
            </Field>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Field label={k.planA} lines={2}>{c.plan_a}</Field>
            <Field label={k.planB} lines={2}>{c.plan_b}</Field>
          </div>
        </div>
      </div>
      <Footer brand={brand} left="" />
    </Sheet>
  );
}

function LocationPage({ l, i, total, brand, t, term }: { l: DeckLocation; i: number; total: number; brand: Brand; t: Dictionary; term: (k: TermKind, v: string) => string }) {
  const k = t.look.locations;
  return (
    <Sheet brand={brand}>
      <div style={{ position: "absolute", insetInline: 0, top: 0, height: 430 }}>
        <Picture src={l.picture} name={l.name} />
      </div>
      <div style={{ position: "absolute", insetInline: 0, top: 430, bottom: 0, padding: "28px 52px 48px", display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 36 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "#7A7774" }}>
            {t.deck.location} {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")} · {term("intExt", l.int_ext)} · <span style={{ color: brand.accent }}>{term("placeMade", l.made_with)}</span>
          </div>
          <h2 className="bidi" style={{ fontSize: 34, fontWeight: 600, margin: "10px 0 0", lineHeight: 1.1 }}>{l.name}</h2>
        </div>
        <Field label={k.description} lines={6}>{l.description}</Field>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label={t.look.art.dressing} lines={3}>{l.dressing}</Field>
          <Field label={l.props.length ? t.look.art.props : k.options} lines={3}>{(l.props.length ? l.props : l.options).join(" · ")}</Field>
        </div>
      </div>
      <Footer brand={brand} left="" />
    </Sheet>
  );
}

function StoryboardPage({ frames, brand, project, d, term, page, pages }: { frames: DeckFrame[]; brand: Brand; project: string; d: Dictionary["deck"]; term: (k: TermKind, v: string) => string; page: number; pages: number }) {
  return (
    <Sheet brand={brand}>
      <div style={{ position: "absolute", insetInline: 40, top: 26, display: "flex", alignItems: "center", gap: 16 }}>
        <Logo brand={brand} />
        <span className="mono" style={{ fontSize: 11, color: "#7A7774", marginInlineStart: "auto", unicodeBidi: "plaintext" }}>{project} · {d.storyboard} · {page}/{pages}</span>
      </div>
      <div style={{ position: "absolute", insetInline: 40, top: 84, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(2, 292px)", columnGap: 24, rowGap: 18 }}>
        {frames.map((f) => (
          <div key={f.n} style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ position: "relative", height: 200, border: "1px solid #DAD6D1" }}>
              <Picture src={f.picture} name={String(f.n)} />
              <span className="mono" style={{ position: "absolute", top: 8, insetInlineStart: 8, background: brand.isMenab ? "#141414" : brand.accent, color: "#fff", fontSize: 11, padding: "3px 7px" }}>{String(f.n).padStart(2, "0")}</span>
              <span className="mono" style={{ position: "absolute", bottom: 8, insetInlineEnd: 8, background: "rgba(255,255,255,.92)", color: "#141414", fontSize: 10, padding: "2px 6px" }}>{f.seconds}s</span>
            </div>
            <div className="mono clamp" style={{ fontSize: 9.5, color: "#7A7774", marginTop: 8, WebkitLineClamp: 1 }}>
              {[term("size", f.size), term("angle", f.angle), term("movement", f.movement), f.lens].filter(Boolean).join(" · ")}
            </div>
            <div className="clamp bidi" style={{ fontSize: 12.5, lineHeight: 1.4, marginTop: 4, WebkitLineClamp: 2 }}>{f.action}</div>
            {f.dialogue && <div className="clamp bidi" style={{ fontSize: 11.5, lineHeight: 1.35, marginTop: 3, color: "#7A7774", fontStyle: "italic", WebkitLineClamp: 1 }}>{f.dialogue}</div>}
          </div>
        ))}
      </div>
      <Footer brand={brand} left="" />
    </Sheet>
  );
}
