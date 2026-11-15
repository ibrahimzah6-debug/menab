"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GROUPS, VIDEO_TYPES, videoType, type VideoTypeGroup } from "@/lib/video-types";
import { chooseVideoType } from "./actions";

// The video type at the top of the brief: Menab's suggestion, or the person's own choice.
export function VideoTypePicker({
  projectId,
  value,
  by,
  editable,
  lang,
  c,
}: {
  projectId: string;
  value: string | null;
  by: string | null;
  editable: boolean;
  lang: "en" | "ar";
  c: { label: string; suggested: string; chosen: string; none: string; soon: string; hidden: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const current = videoType(value);
  const groups = Object.keys(GROUPS) as VideoTypeGroup[];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor="video-type" className="mn-label grow">{c.label}</label>
        {current && <span className={`mn-chip ${by === "person" ? "mn-chip--approved" : "mn-chip--ready"}`}>{by === "person" ? c.chosen : c.suggested}</span>}
      </div>
      <select
        id="video-type"
        className="mn-select h-9 w-full"
        value={current?.id ?? ""}
        disabled={!editable || pending}
        onChange={(e) =>
          start(async () => {
            const r = await chooseVideoType(projectId, e.target.value);
            setError(r.error);
            router.refresh();
          })
        }
      >
        {!current && <option value="">{c.none}</option>}
        {groups.map((g) => (
          <optgroup key={g} label={GROUPS[g][lang]}>
            {VIDEO_TYPES.filter((v) => v.group === g).map((v) => (
              <option key={v.id} value={v.id} disabled={v.soon}>
                {v[lang]}
                {v.soon ? ` (${c.soon})` : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {current && <span className="text-[12px] text-ink-faint" dir="auto">{current.length}</span>}
      {error && <span className="small" role="alert">{error}</span>}
    </div>
  );
}
