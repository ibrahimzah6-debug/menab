"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ModelPicker, type PickerOption } from "@/components/model-picker";
import { chooseTextModel } from "./actions";

// The model picker on the step itself. The choice is remembered for this project.
export function StepModelPicker({
  projectId,
  label,
  options,
  value,
  defaultLabel,
  disabled,
}: {
  projectId: string;
  label: string;
  options: PickerOption[];
  value: string;
  defaultLabel: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [pending, start] = useTransition();
  return (
    <ModelPicker
      label={label}
      options={options}
      value={current}
      defaultLabel={defaultLabel}
      testedLabel=""
      disabled={disabled || pending}
      onChange={(id) => {
        setCurrent(id);
        start(async () => {
          await chooseTextModel(projectId, id);
          router.refresh();
        });
      }}
    />
  );
}
