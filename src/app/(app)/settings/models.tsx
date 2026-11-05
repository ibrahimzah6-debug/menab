"use client";

import { useState, useTransition } from "react";
import { ModelPicker, type PickerOption } from "@/components/model-picker";
import { saveDefaultModel } from "./actions";

export function DefaultModel({
  task,
  label,
  options,
  value,
  canChange,
  defaultLabel,
  testedLabel,
  savedLabel,
}: {
  task: "text" | "image" | "video" | "voice";
  label: string;
  options: PickerOption[];
  value: string;
  canChange: boolean;
  defaultLabel: string;
  testedLabel: string;
  savedLabel: string;
}) {
  const [current, setCurrent] = useState(value);
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="mn-label">{label}</span>
      <ModelPicker
        label={label}
        options={options}
        value={current}
        defaultLabel={defaultLabel}
        testedLabel={testedLabel}
        disabled={!canChange || pending}
        onChange={(id) => {
          setCurrent(id);
          start(async () => {
            const res = await saveDefaultModel(task, id);
            setNote(res.error ?? savedLabel);
          });
        }}
      />
      {note && <span className="small text-ink-muted" role="status">{note}</span>}
    </div>
  );
}
