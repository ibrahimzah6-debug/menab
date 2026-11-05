import Link from "next/link";
import { IconCheck } from "@/components/icons";

// Done stages show a check and open read-only, the current one is a filled pill, future ones
// are locked. Done stages and the current one are links; the stage on screen is underlined
// when it is not the current one, so the person always knows where they are.
export function StageBar({
  stages,
  current,
  label,
  links,
  viewing,
}: {
  stages: string[];
  current: number;
  label: string;
  links?: (string | null)[];
  viewing?: number;
}) {
  return (
    <div className="overflow-x-auto max-w-full">
      <nav className="mn-stagebar" style={{ flexWrap: "nowrap" }} aria-label={label}>
        {stages.map((name, i) => {
          const n = String(i + 1).padStart(2, "0");
          const href = links?.[i] ?? null;
          const seen = viewing === i && i !== current;
          if (i < current) {
            const inner = (
              <>
                <IconCheck />
                <span className={seen ? "underline underline-offset-4" : ""}>{name}</span>
              </>
            );
            return href ? (
              <Link key={name} href={href} aria-current={seen ? "page" : undefined} className={`mn-stage mn-stage--done whitespace-nowrap hover:text-ink ${seen ? "text-ink" : ""}`}>
                {inner}
              </Link>
            ) : (
              <span key={name} className="mn-stage mn-stage--done whitespace-nowrap">{inner}</span>
            );
          }
          if (i === current) {
            const inner = (
              <>
                <span className="mn-stage__num">{n}</span>
                {name}
              </>
            );
            return href ? (
              <Link key={name} href={href} className="mn-stage mn-stage--current whitespace-nowrap" aria-current="step">{inner}</Link>
            ) : (
              <span key={name} className="mn-stage mn-stage--current whitespace-nowrap" aria-current="step">{inner}</span>
            );
          }
          return (
            <span key={name} className="mn-stage whitespace-nowrap">
              <span className="mn-stage__num">{n}</span>
              {name}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
