import { IconCheck } from "./icons";

export type OutputStatus = "waiting" | "generating" | "ready" | "edited" | "approved";

// Status is told apart by shape and word, never by color alone.
export function StatusChip({ status, label }: { status: OutputStatus | "invited" | "active"; label: string }) {
  const variant =
    status === "approved" || status === "active"
      ? "approved"
      : status === "generating"
        ? "generating"
        : status === "waiting" || status === "invited"
          ? "waiting"
          : "ready";
  return (
    <span className={`mn-chip mn-chip--${variant}`}>
      {variant === "approved" && <IconCheck />}
      {variant === "generating" && <span className="mn-chip__icon" aria-hidden="true" />}
      {label}
    </span>
  );
}
