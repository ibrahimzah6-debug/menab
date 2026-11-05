"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@/components/icons";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { browserClient } from "@/lib/supabase/client";
import { addAssets, prepareLibraryUpload, removeLibraryItem, saveLibraryItem, updateAsset, type LibraryTable } from "./actions";

export type LibTab = "brand" | "characters" | "locations" | "assets";
export type LibItem = {
  id: string;
  name: string;
  logo_path?: string | null;
  colors?: string[];
  fonts?: string[];
  tone?: string | null;
  notes?: string | null;
  description?: string | null;
  age?: string | null;
  look?: string | null;
  wardrobe?: string | null;
  voice?: string | null;
  city?: string | null;
  kind?: string | null;
  image_paths?: string[];
  path?: string;
  mime?: string;
  size_bytes?: number;
};

type L = Dictionary["libraries"];
const TABLE: Record<Exclude<LibTab, "assets">, LibraryTable> = { brand: "brand_kits", characters: "characters", locations: "locations" };

async function uploadFile(file: File) {
  const prep = await prepareLibraryUpload(file.name, file.type, file.size);
  if (prep.error || !prep.path || !prep.token) throw new Error(prep.error ?? "Upload failed");
  const { error } = await browserClient().storage.from("media").uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type });
  if (error) throw new Error("Upload failed. Try again.");
  return prep.path;
}

const sizeText = (n = 0) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function LibraryView({ tab, items, urls, l, canEdit }: { tab: LibTab; items: LibItem[]; urls: Record<string, string>; l: L; canEdit: boolean }) {
  const [editing, setEditing] = useState<LibItem | "new" | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [uploading, setUploading] = useState(0);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadAssets = async (list: FileList | null) => {
    const files = Array.from(list ?? []).slice(0, 20);
    if (!files.length) return;
    setError(undefined);
    setUploading(files.length);
    const done: { path: string; name: string; mime: string; size: number }[] = [];
    for (const f of files) {
      try {
        done.push({ path: await uploadFile(f), name: f.name, mime: f.type, size: f.size });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      setUploading((n) => n - 1);
    }
    const res = await addAssets(done);
    if (res.error) setError(res.error);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {canEdit ? (
          tab === "assets" ? (
            <>
              <input ref={fileRef} type="file" multiple className="hidden" accept="image/*,application/pdf,audio/*,video/mp4,video/quicktime,video/webm" onChange={(e) => { uploadAssets(e.target.files); e.target.value = ""; }} />
              <button type="button" className="mn-btn mn-btn--primary" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
                <IconPlus size={16} />
                {uploading > 0 ? `${l.uploading} (${uploading})` : l.add.assets}
              </button>
              <span className="small text-ink-muted">{l.fileRules}</span>
            </>
          ) : (
            <button type="button" className="mn-btn mn-btn--primary" onClick={() => setEditing("new")}>
              <IconPlus size={16} />
              {l.add[tab]}
            </button>
          )
        ) : (
          <p className="small text-ink-muted m-0">{l.viewerNote}</p>
        )}
        {error && <p role="alert" className="small m-0 px-3 py-2 rounded-md bg-tint-2">{error}</p>}
      </div>

      {items.length === 0 ? (
        <div className="bg-surface border border-dashed border-line-strong rounded-lg p-10 text-center">
          <p className="body text-ink-muted m-0 max-w-[520px] mx-auto">{l.empty[tab]}</p>
        </div>
      ) : tab === "assets" ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {items.map((x) => <AssetCard key={x.id} item={x} url={x.path ? urls[x.path] : undefined} l={l} canEdit={canEdit} onError={setError} />)}
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {items.map((x) => (
            <button key={x.id} type="button" onClick={() => setEditing(x)} className="mn-card text-start p-0 overflow-hidden hover:border-line-strong" style={{ padding: 0, width: "auto" }}>
              <Cover tab={tab} item={x} urls={urls} />
              <div className="p-4 flex flex-col gap-1.5">
                <span className="text-[15px] font-medium" dir="auto">{x.name}</span>
                {tab === "brand" ? (
                  <span className="small text-ink-muted" dir="auto">{(x.fonts ?? []).join(" · ") || x.tone || ""}</span>
                ) : (
                  <span className="small text-ink-muted line-clamp-2" dir="auto">
                    {[tab === "characters" ? x.age : x.city, x.description].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && tab !== "assets" && (
        <Editor tab={tab} item={editing === "new" ? null : editing} urls={urls} l={l} canEdit={canEdit} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function Cover({ tab, item, urls }: { tab: LibTab; item: LibItem; urls: Record<string, string> }) {
  if (tab === "brand") {
    const logo = item.logo_path ? urls[item.logo_path] : undefined;
    return (
      <div className="h-[120px] bg-ground-deep border-b border-line flex items-center justify-center relative">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="max-h-[64px] max-w-[70%] object-contain" />
        ) : (
          <span className="h2 text-ink-faint">{item.name.slice(0, 1)}</span>
        )}
        {(item.colors?.length ?? 0) > 0 && (
          <div className="absolute bottom-2 start-2 flex gap-1">
            {item.colors!.slice(0, 6).map((c) => <span key={c} className="w-4 h-4 rounded-full border border-line" style={{ background: c }} title={c} />)}
          </div>
        )}
      </div>
    );
  }
  const first = item.image_paths?.[0];
  const src = first ? urls[first] : undefined;
  return (
    <div className="aspect-[4/3] bg-ground-deep border-b border-line overflow-hidden grid place-items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <span className="h2 text-ink-faint">{item.name.slice(0, 1)}</span>}
    </div>
  );
}

function AssetCard({ item, url, l, canEdit, onError }: { item: LibItem; url?: string; l: L; canEdit: boolean; onError: (e?: string) => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const isImage = item.mime?.startsWith("image/");
  const kinds = Object.entries(l.assetKinds);
  return (
    <div className="mn-card p-0 overflow-hidden" style={{ padding: 0, width: "auto", opacity: pending ? 0.6 : 1 }}>
      <a href={url} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-ground-deep border-b border-line overflow-hidden grid place-items-center" aria-label={`${l.open} ${item.name}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {isImage && url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <span className="mn-label">{(item.mime ?? "").split("/")[1]?.slice(0, 8) || "file"}</span>}
      </a>
      <div className="p-3 flex flex-col gap-2">
        <span className="small font-medium truncate" dir="auto" title={item.name}>{item.name}</span>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <select
              aria-label={l.fields.fileKind}
              className="mn-select"
              style={{ height: 28, fontSize: 12, minWidth: 0 }}
              defaultValue={item.kind ?? "other"}
              onChange={(e) => start(async () => { const r = await updateAsset(item.id, { kind: e.target.value }); onError(r.error); router.refresh(); })}
            >
              {kinds.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          ) : (
            <span className="mn-chip mn-chip--waiting">{l.assetKinds[(item.kind ?? "other") as keyof L["assetKinds"]]}</span>
          )}
          <span className="data text-ink-faint text-[11px]">{sizeText(item.size_bytes)}</span>
          <span className="grow" />
          {canEdit && (
            <button
              type="button"
              className="text-[12px] text-ink-muted hover:text-ink underline"
              onClick={() => {
                if (!confirm(l.removeConfirm)) return;
                start(async () => { const r = await removeLibraryItem("assets", item.id); onError(r.error); router.refresh(); });
              }}
            >
              {l.remove}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// The side panel to add or change a brand kit, character or location.
function Editor({ tab, item, urls, l, canEdit, onClose }: { tab: Exclude<LibTab, "assets">; item: LibItem | null; urls: Record<string, string>; l: L; canEdit: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [colors, setColors] = useState<string[]>(item?.colors ?? []);
  const [fonts, setFonts] = useState<string[]>(item?.fonts ?? []);
  const [images, setImages] = useState<string[]>(item?.image_paths ?? []);
  const [logo, setLogo] = useState<string | null>(item?.logo_path ?? null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(0);
  const photoRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const f = l.fields;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const src = (p: string) => previews[p] ?? urls[p];

  const addImages = async (list: FileList | null, single = false) => {
    const files = Array.from(list ?? []).filter((x) => x.type.startsWith("image/")).slice(0, single ? 1 : 12 - images.length);
    setBusy((n) => n + files.length);
    for (const file of files) {
      try {
        const path = await uploadFile(file);
        setPreviews((p) => ({ ...p, [path]: URL.createObjectURL(file) }));
        if (single) setLogo(path);
        else setImages((x) => [...x, path]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      setBusy((n) => n - 1);
    }
  };

  const submit = (form: FormData) => {
    const data: Record<string, unknown> = {};
    form.forEach((v, k) => (data[k] = v));
    if (tab === "brand") Object.assign(data, { colors, fonts, logo_path: logo ?? "" });
    else data.image_paths = images;
    start(async () => {
      const res = await saveLibraryItem(TABLE[tab], item?.id ?? null, data);
      if (res.error) return setError(res.error);
      router.refresh();
      onClose();
    });
  };

  const label = "mn-label";
  const field = (name: string, title: string, multiline = false, value?: string | null) => (
    <label className="flex flex-col gap-1.5">
      <span className={label}>{title}</span>
      {multiline ? (
        <textarea name={name} defaultValue={value ?? ""} rows={3} dir="auto" disabled={!canEdit} className="mn-input" style={{ height: "auto", paddingTop: 8, paddingBottom: 8, resize: "vertical" }} />
      ) : (
        <input name={name} defaultValue={value ?? ""} dir="auto" disabled={!canEdit} className="mn-input" required={name === "name"} maxLength={name === "name" ? 120 : 4000} />
      )}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={item?.name ?? l.add[tab]}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <form
        action={submit}
        className="relative w-full max-w-[460px] h-full bg-surface border-s border-line flex flex-col"
        style={{ boxShadow: "var(--shadow-float)" }}
      >
        <div className="flex items-center gap-3 px-5 h-14 border-b border-line shrink-0">
          <h2 className="h3 m-0 grow truncate" dir="auto">{item?.name ?? l.add[tab]}</h2>
          <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" onClick={onClose}>{l.close}</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
          {field("name", f.name, false, item?.name)}

          {tab === "brand" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <span className={label}>{f.logo}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-16 rounded-md border border-line bg-ground-deep grid place-items-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {logo && src(logo) ? <img src={src(logo)} alt="" className="max-w-full max-h-full object-contain" /> : null}
                  </div>
                  {canEdit && (
                    <>
                      <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { addImages(e.target.files, true); e.target.value = ""; }} />
                      <button type="button" className="mn-btn mn-btn--secondary mn-btn--sm" onClick={() => logoRef.current?.click()}>{busy ? l.uploading : f.logo}</button>
                      {logo && <button type="button" className="small underline text-ink-muted" onClick={() => setLogo(null)}>{l.remove}</button>}
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={label}>{f.colors}</span>
                <div className="flex flex-wrap gap-2 items-center">
                  {colors.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 h-8 ps-1 pe-2 rounded-full border border-line">
                      <input type="color" aria-label={c} value={/^#[0-9a-f]{6}$/i.test(c) ? c : "#000000"} disabled={!canEdit} onChange={(e) => setColors(colors.map((x, j) => (j === i ? e.target.value : x)))} className="w-6 h-6 rounded-full border-0 p-0 bg-transparent" />
                      <span className="data text-[12px]">{c}</span>
                      {canEdit && <button type="button" aria-label={`${l.remove} ${c}`} className="text-ink-muted hover:text-ink" onClick={() => setColors(colors.filter((_, j) => j !== i))}>×</button>}
                    </span>
                  ))}
                  {canEdit && colors.length < 12 && (
                    <button type="button" className="h-8 px-3 rounded-full border border-dashed border-line-strong small text-ink-muted hover:text-ink" onClick={() => setColors([...colors, "#000000"])}>+ {l.addColor}</button>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={label}>{f.fonts}</span>
                <div className="flex flex-wrap gap-2 items-center">
                  {fonts.map((x, i) => (
                    <span key={i} className="mn-chip mn-chip--ready">
                      {x}
                      {canEdit && <button type="button" aria-label={`${l.remove} ${x}`} onClick={() => setFonts(fonts.filter((_, j) => j !== i))}>×</button>}
                    </span>
                  ))}
                  {canEdit && fonts.length < 6 && (
                    <input
                      placeholder={`+ ${l.addFont}`}
                      aria-label={l.addFont}
                      className="mn-input"
                      style={{ height: 30, width: 150, fontSize: 13 }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const v = e.currentTarget.value.trim();
                        if (v) setFonts([...fonts, v.slice(0, 60)]);
                        e.currentTarget.value = "";
                      }}
                    />
                  )}
                </div>
              </div>
              {field("tone", f.tone, true, item?.tone)}
              {field("notes", f.notes, true, item?.notes)}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <span className={label}>{f.photos}</span>
                <div className="grid grid-cols-3 gap-2">
                  {images.map((p) => (
                    <div key={p} className="relative aspect-square rounded-md overflow-hidden border border-line bg-ground-deep">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {src(p) && <img src={src(p)} alt="" className="w-full h-full object-cover" />}
                      {canEdit && (
                        <button type="button" aria-label={l.remove} className="absolute top-1 end-1 w-6 h-6 rounded-full bg-surface/90 border border-line grid place-items-center text-[13px]" onClick={() => setImages(images.filter((x) => x !== p))}>×</button>
                      )}
                    </div>
                  ))}
                  {canEdit && images.length < 12 && (
                    <>
                      <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addImages(e.target.files); e.target.value = ""; }} />
                      <button type="button" className="aspect-square rounded-md border border-dashed border-line-strong grid place-items-center small text-ink-muted hover:text-ink" onClick={() => photoRef.current?.click()}>
                        {busy ? l.uploading : `+ ${l.addPhotos}`}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {tab === "characters" ? (
                <>
                  {field("age", f.age, false, item?.age)}
                  {field("description", f.description, true, item?.description)}
                  {field("look", f.look, true, item?.look)}
                  {field("wardrobe", f.wardrobe, true, item?.wardrobe)}
                  {field("voice", f.voice, false, item?.voice)}
                </>
              ) : (
                <>
                  {field("city", f.city, false, item?.city)}
                  <label className="flex flex-col gap-1.5">
                    <span className={label}>{f.kind}</span>
                    <select name="kind" defaultValue={item?.kind ?? "either"} disabled={!canEdit} className="mn-select">
                      {Object.entries(l.kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                  {field("description", f.notes, true, item?.description)}
                </>
              )}
            </>
          )}
          {error && <p role="alert" className="small m-0 px-3 py-2 rounded-md bg-tint-2">{error}</p>}
        </div>
        {canEdit && (
          <div className="shrink-0 border-t border-line px-5 py-3 flex items-center gap-2">
            <button className="mn-btn mn-btn--primary" disabled={pending || busy > 0}>{pending ? l.saving : l.save}</button>
            <button type="button" className="mn-btn mn-btn--ghost" onClick={onClose}>{l.cancel}</button>
            <span className="grow" />
            {item && (
              <button
                type="button"
                className="small underline text-ink-muted hover:text-ink"
                onClick={() => {
                  if (!confirm(l.removeConfirm)) return;
                  start(async () => {
                    const r = await removeLibraryItem(TABLE[tab], item.id);
                    if (r.error) return setError(r.error);
                    router.refresh();
                    onClose();
                  });
                }}
              >
                {l.remove}
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
