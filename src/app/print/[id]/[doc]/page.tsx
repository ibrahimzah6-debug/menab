import { notFound } from "next/navigation";
import { findTerm, type TermKind } from "@/lib/film-terms";
import { loadDeck, type Brand, type DeckCharacter, type DeckFrame, type DeckLocation } from "@/lib/deck";
import { fill, type Dictionary } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { DEPARTMENTS } from "@/lib/crew";
import { createClient } from "@/lib/supabase/server";
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
  const callDay = /^call-sheet-(\d{1,2})$/.exec(doc)?.[1];
  if (!["look-book", "storyboard", "ppm", "cps", "permit"].includes(doc) && !callDay) notFound();
  const deck = await loadDeck(id);
  if (!deck) notFound();
  const { t, locale, dir } = await getI18n();
  const d = t.deck;
  const lang = locale === "ar" ? "ar" : "en";
  const term = (kind: TermKind, v: string) => findTerm(kind, v)?.[lang] ?? v;
  const date = new Date().toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" });
  const title = doc === "storyboard" ? d.storyboard : doc === "ppm" ? t.outputs[27] : doc === "cps" ? "CPS" : doc === "permit" ? t.outputs[25] : callDay ? `${t.outputs[32]} · ${callDay}` : d.lookBook;
  const x = deck.extra;
  const b = deck.brand;

  const pages: React.ReactNode[] = [];
  const cover = [...deck.characters.map((c) => c.picture), ...deck.storyboard.map((f) => f.picture), ...deck.locations.map((l) => l.picture)].filter(Boolean) as string[];
  pages.push(<Cover key="cover" brand={b} title={title} project={deck.project.name} client={deck.project.client} date={date} pictures={doc === "storyboard" ? deck.storyboard.map((f) => f.picture).filter(Boolean) as string[] : cover} d={d} />);

  const lookPages = () => {
    if (deck.characters.length) {
      pages.push(<Divider key="dc" brand={b} label={d.characters} count={deck.characters.length} />);
      deck.characters.forEach((c, i) => pages.push(<CharacterPage key={`c${i}`} c={c} i={i} total={deck.characters.length} brand={b} t={t} term={term} />));
    }
    if (deck.locations.length) {
      pages.push(<Divider key="dl" brand={b} label={d.locations} count={deck.locations.length} />);
      deck.locations.forEach((l, i) => pages.push(<LocationPage key={`l${i}`} l={l} i={i} total={deck.locations.length} brand={b} t={t} term={term} />));
    }
  };
  const boardPages = () => {
    const per = 6;
    for (let i = 0; i < deck.storyboard.length; i += per) {
      pages.push(<StoryboardPage key={`s${i}`} frames={deck.storyboard.slice(i, i + per)} brand={b} project={deck.project.name} d={d} term={term} page={i / per + 1} pages={Math.ceil(deck.storyboard.length / per)} />);
    }
  };
  // A table that runs over several pages when it is long.
  const tablePages = (key: string, heading: string, head: string[], rows: string[][], per = 11) => {
    for (let i = 0; i < Math.max(rows.length, 1); i += per) pages.push(<TablePage key={`${key}${i}`} brand={b} heading={heading} head={head} rows={rows.slice(i, i + per)} />);
  };
  const dept = (id: string) => DEPARTMENTS.find((v) => v.id === id)?.[lang] ?? id;
  const crewRows = [...x.crew].sort((a, c) => DEPARTMENTS.findIndex((v) => v.id === a.department) - DEPARTMENTS.findIndex((v) => v.id === c.department)).map((m) => [dept(m.department), m.role, m.name, m.phone]);
  const P = t.preprod;

  if (doc === "ppm") {
    // Bogshah and NOVA order: brief, crew, storyline, storyboard, mood, cinematography, design,
    // editing and sound, locations, cast, art, wardrobe.
    if (x.summary?.paragraphs?.length) pages.push(<TextPage key="brief" brand={b} heading={t.outputs[3]} title={x.summary.title} paragraphs={x.summary.paragraphs} />);
    if (crewRows.length) tablePages("crew", t.outputs[22], [P.crew.department, P.crew.role, P.crew.name, P.crew.phone], crewRows);
    if (x.script.length) tablePages("story", t.outputs[9], [t.creative.script.scene, t.creative.script.picture, t.creative.script.sound, t.creative.script.vo, t.creative.script.seconds], x.script.map((r) => [r.scene, r.picture, r.sound, (lang === "ar" ? r.vo_ar || r.vo_en : r.vo_en || r.vo_ar) ?? "", String(r.seconds)]), 8);
    boardPages();
    if (x.mood) pages.push(<MoodPage key="mood" brand={b} heading={t.outputs[11]} mood={x.mood} labels={t.creative.mood} treatment={x.treatment} treatmentLabel={t.outputs[10]} />);
    lookPages();
    if (x.art.length) tablePages("art", t.outputs[16], [t.look.art.set, t.look.art.dressing, t.look.art.props], x.art.map((a) => [a.set, a.dressing, a.props.join(", ")]), 8);
    if (x.wardrobe.length) tablePages("ward", t.outputs[14], [t.look.wardrobe.character, t.look.wardrobe.scene, t.look.wardrobe.outfit, t.look.wardrobe.continuity], x.wardrobe.map((w) => [w.character, w.scene, w.outfit, (w as { continuity?: string }).continuity ?? ""]));
    if (x.meeting?.changes?.length || x.meeting?.signed) pages.push(<TextPage key="meet" brand={b} heading={t.outputs[28]} title={[x.meeting?.client, x.meeting?.date].filter(Boolean).join(" · ")} paragraphs={[...(x.meeting?.changes ?? []), x.meeting?.signed ? P.meeting.signed : ""].filter(Boolean)} />);
  } else if (doc === "permit") {
    // ID numbers are added only here, when the sheet is built: Admins and Coordinators get the
    // full number (each one logged as an export), everyone else the masked last 4.
    const supabase = await createClient();
    const rows: string[][] = [];
    for (const m of x.crew) {
      const { data } = await supabase.rpc("reveal_crew_id", { p_crew: m.crew_id, purpose: "export" });
      const { data: masked } = data ? { data: null } : await supabase.from("crew").select("id_last4").eq("id", m.crew_id).maybeSingle();
      rows.push([m.name, m.role, (data as string | null) ?? (masked?.id_last4 ? `•••••• ${masked.id_last4}` : "–")]);
    }
    if (x.permits) {
      pages.push(<TextPage key="pp" brand={b} heading={t.outputs[25]} title={`${P.permits.purpose}: ${x.permits.purpose}`} paragraphs={[`${P.permits.dates}: ${x.permits.dates}`, `${x.permits.type}`, x.permits.drone ? P.permits.drone : ""].filter(Boolean)} />);
      tablePages("pl", P.permits.locations, [P.permits.region, P.permits.city, P.permits.place], x.permits.locations.map((l) => [l.region, l.city, l.place]));
    }
    if (rows.length) tablePages("pc", t.outputs[22], [P.crew.name, P.crew.role, P.crew.id], rows, 12);
  } else if (doc === "cps") {
    if (x.cps?.milestones?.length) pages.push(<CpsPage key="cps" brand={b} milestones={x.cps.milestones} note={x.cps.note ?? ""} lang={lang} />);
  } else if (callDay) {
    const sheet = x.callSheets.find((c) => String(c.day) === callDay);
    const day = x.schedule.find((c) => String(c.day) === callDay);
    if (sheet) {
      pages.push(<CallSheetPage key="cs" brand={b} project={deck.project.name} sheet={sheet} total={x.callSheets.length} labels={P.calls} />);
      if (crewRows.length) tablePages("csc", `${t.outputs[22]} · ${P.calls.crewCall} ${sheet.crew_call}`, [P.crew.department, P.crew.role, P.crew.name, P.crew.phone], crewRows, 12);
      if (day?.sets.length) tablePages("css", t.outputs[31], [P.schedule.time, P.schedule.set, P.schedule.scene, P.schedule.intExt, P.schedule.dayNight, P.schedule.shots, P.schedule.cast, P.schedule.props, P.schedule.prep], day.sets.map((st) => [st.time, st.set, st.scene, st.int_ext, st.day_night, st.shots.join(", "), st.cast.join(", "), st.props.join(", "), `${st.prep_minutes}′`]), 10);
    }
  } else if (doc === "look-book") {
    lookPages();
  } else {
    boardPages();
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

function Heading({ brand, text }: { brand: Brand; text: string }) {
  return (
    <div style={{ position: "absolute", insetInline: 48, top: 30, display: "flex", alignItems: "center", gap: 16 }}>
      <span style={{ width: 6, height: 26, background: brand.accent }} />
      <h2 className="bidi" style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>{text}</h2>
      <span style={{ marginInlineStart: "auto" }}><Logo brand={brand} /></span>
    </div>
  );
}

function TextPage({ brand, heading, title, paragraphs }: { brand: Brand; heading: string; title?: string; paragraphs: string[] }) {
  return (
    <Sheet brand={brand}>
      <Heading brand={brand} text={heading} />
      <div style={{ position: "absolute", insetInline: 48, top: 100, bottom: 56, maxWidth: 900, display: "flex", flexDirection: "column", gap: 14 }}>
        {title && <h3 className="bidi" style={{ fontSize: 22, margin: 0, fontWeight: 600 }}>{title}</h3>}
        {paragraphs.map((x, i) => <p key={i} className="bidi" style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}>{x}</p>)}
      </div>
      <Footer brand={brand} left="" />
    </Sheet>
  );
}

function TablePage({ brand, heading, head, rows }: { brand: Brand; heading: string; head: string[]; rows: string[][] }) {
  return (
    <Sheet brand={brand}>
      <Heading brand={brand} text={heading} />
      <table style={{ position: "absolute", insetInline: 48, top: 92, width: "calc(100% - 96px)", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>{head.map((h, i) => <th key={i} className="mono" style={{ textAlign: "start", fontSize: 10, color: "#7A7774", padding: "6px 10px 6px 0", borderBottom: `2px solid ${brand.accent}` }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className="bidi" style={{ padding: "7px 10px 7px 0", borderBottom: "1px solid #E4E1DC", verticalAlign: "top", lineHeight: 1.35 }}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <Footer brand={brand} left="" />
    </Sheet>
  );
}

function MoodPage({ brand, heading, mood, labels, treatment, treatmentLabel }: { brand: Brand; heading: string; mood: { look?: string; palette?: { name: string; hex: string }[]; light?: string; camera?: string; grade?: string }; labels: Dictionary["creative"]["mood"]; treatment?: { idea?: string; tone?: string }; treatmentLabel: string }) {
  const block = (label: string, text?: string) => (text ? <div><div className="mono" style={{ fontSize: 10, color: "#7A7774", marginBottom: 4 }}>{label}</div><p className="bidi" style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>{text}</p></div> : null);
  return (
    <Sheet brand={brand}>
      <Heading brand={brand} text={heading} />
      <div style={{ position: "absolute", insetInline: 48, top: 96, bottom: 56, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {block(labels.look, mood.look)}
          {block(labels.light, mood.light)}
          {block(labels.camera, mood.camera)}
          {block(labels.grade, mood.grade)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(mood.palette ?? []).map((c, i) => (
              <div key={i} style={{ width: 96 }}>
                <div style={{ height: 64, background: /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#888", border: "1px solid #DAD6D1" }} />
                <div className="bidi" style={{ fontSize: 11, marginTop: 4 }}>{c.name}</div>
                <div className="mono" style={{ fontSize: 9.5, color: "#7A7774" }}>{c.hex}</div>
              </div>
            ))}
          </div>
          {block(treatmentLabel, [treatment?.idea, treatment?.tone].filter(Boolean).join(" "))}
        </div>
      </div>
      <Footer brand={brand} left="" />
    </Sheet>
  );
}

// The CPS as a calendar: Sunday to Saturday weeks, each milestone written on its days.
function CpsPage({ brand, milestones, note, lang }: { brand: Brand; milestones: { name: string; start: string; end: string; phase: string }[]; note: string; lang: "en" | "ar" }) {
  const days = milestones.flatMap((m) => [m.start, m.end]).map((x) => new Date(`${x}T00:00:00Z`)).filter((x) => !isNaN(x.getTime()));
  if (!days.length) return null;
  const first = new Date(Math.min(...days.map((x) => x.getTime())));
  first.setUTCDate(first.getUTCDate() - first.getUTCDay());
  const last = new Date(Math.max(...days.map((x) => x.getTime())));
  const weeks = Math.min(10, Math.ceil((last.getTime() - first.getTime()) / 86_400_000 / 7) + 1);
  const names = lang === "ar" ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const phase: Record<string, { bg: string; tag: string }> = { pre: { bg: "#EFEDEA", tag: "PRE" }, production: { bg: brand.isMenab ? "#DAD6D1" : `${brand.accent}33`, tag: "PROD" }, post: { bg: "#F7F5F2", tag: "POST" } };
  const on = (d: Date) => milestones.filter((m) => m.start <= d.toISOString().slice(0, 10) && d.toISOString().slice(0, 10) <= m.end);
  return (
    <Sheet brand={brand}>
      <Heading brand={brand} text="CPS" />
      <div style={{ position: "absolute", insetInline: 48, top: 86, bottom: 70, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: `22px repeat(${weeks}, 1fr)`, gap: 3 }}>
        {names.map((n) => <div key={n} className="mono" style={{ fontSize: 10, color: "#7A7774" }}>{n}</div>)}
        {Array.from({ length: weeks * 7 }, (_, i) => {
          const d = new Date(first.getTime() + i * 86_400_000);
          const items = on(d);
          return (
            <div key={i} style={{ border: "1px solid #E4E1DC", padding: 4, overflow: "hidden", background: items[0] ? phase[items[0].phase]?.bg : "transparent" }}>
              <div className="mono" style={{ fontSize: 9, color: "#7A7774" }}>{d.getUTCDate()}/{d.getUTCMonth() + 1}</div>
              {items.slice(0, 2).map((m, j) => <div key={j} className="bidi" style={{ fontSize: 9.5, lineHeight: 1.2, marginTop: 2 }}>{m.name} <span className="mono" style={{ fontSize: 8, color: "#7A7774" }}>{phase[m.phase]?.tag}</span></div>)}
            </div>
          );
        })}
      </div>
      <p className="bidi" style={{ position: "absolute", insetInline: 48, bottom: 40, fontSize: 11, color: "#4A4744", margin: 0 }}>{note}</p>
      <Footer brand={brand} left="" />
    </Sheet>
  );
}

type CallSheet = { day: number; date: string; crew_call: string; client_call: string; first_roll: string; meals: string; wrap: string; sunrise: string; sunset: string; weather: string; locations: { name: string; address: string; map_link: string; parking: string; contact: string }[]; nearest_hospital: string; safety: string[] };

function CallSheetPage({ brand, project, sheet, total, labels }: { brand: Brand; project: string; sheet: CallSheet; total: number; labels: Dictionary["preprod"]["calls"] }) {
  const k = labels;
  const times: [string, string][] = [[k.crewCall, sheet.crew_call], [k.clientCall, sheet.client_call], [k.roll, sheet.first_roll], [k.meals, sheet.meals], [k.wrap, sheet.wrap], [k.sunrise, sheet.sunrise], [k.sunset, sheet.sunset], [k.weather, sheet.weather]];
  return (
    <Sheet brand={brand}>
      <div style={{ position: "absolute", insetInline: 48, top: 28, display: "flex", alignItems: "center", gap: 16 }}>
        <Logo brand={brand} />
        <div style={{ marginInlineStart: "auto", textAlign: "end" }}>
          <div className="bidi" style={{ fontSize: 22, fontWeight: 600 }}>{project}</div>
          <div className="mono" style={{ fontSize: 11, color: "#7A7774" }}>{k.day.replace("{n}", String(sheet.day)).replace("{total}", String(total))} · {sheet.date}</div>
        </div>
      </div>
      <div style={{ position: "absolute", insetInline: 48, top: 96, display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8 }}>
        {times.map(([l, v]) => (
          <div key={l} style={{ borderTop: `3px solid ${brand.accent}`, paddingTop: 6 }}>
            <div className="mono" style={{ fontSize: 9, color: "#7A7774" }}>{l}</div>
            <div className="bidi" style={{ fontSize: 14, fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", insetInline: 48, top: 176, bottom: 56, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 28 }}>
        <div>
          <div className="mono" style={{ fontSize: 10, color: "#7A7774", marginBottom: 6 }}>{k.location}</div>
          {sheet.locations.map((l, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div className="bidi" style={{ fontSize: 15, fontWeight: 600 }}>{l.name}</div>
              <div className="bidi" style={{ fontSize: 12.5 }}>{l.address}</div>
              {l.map_link && <div style={{ fontSize: 11 }}><a href={l.map_link} style={{ color: "#4A4744" }}>{l.map_link.slice(0, 70)}</a></div>}
              <div className="bidi" style={{ fontSize: 12, color: "#4A4744" }}>{k.parking}: {l.parking} · {k.contact}: {l.contact}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div><div className="mono" style={{ fontSize: 10, color: "#7A7774" }}>{k.hospital}</div><div className="bidi" style={{ fontSize: 13 }}>{sheet.nearest_hospital}</div></div>
          <div><div className="mono" style={{ fontSize: 10, color: "#7A7774" }}>{k.emergency}</div><div style={{ fontSize: 13 }} dir="ltr">911 · 997 · 998 · 999</div></div>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "#7A7774" }}>{k.safety}</div>
            {sheet.safety.map((x, i) => <div key={i} className="bidi" style={{ fontSize: 12, lineHeight: 1.4 }}>☐ {x}</div>)}
          </div>
        </div>
      </div>
      <Footer brand={brand} left="" />
    </Sheet>
  );
}
