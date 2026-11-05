import { IconCheck } from "@/components/icons";

// Done stages show a check and open read-only, the current one is a filled pill, future ones are locked.
export function StageBar({ stages, current, label }: { stages: string[]; current: number; label: string }) {
  return (
    <div className="overflow-x-auto max-w-full">
      <nav className="mn-stagebar" style={{ flexWrap: "nowrap" }} aria-label={label}>
        {stages.map((name, i) => {
          const n = String(i + 1).padStart(2, "0");
          if (i < current)
            return (
              <span key={name} className="mn-stage mn-stage--done whitespace-nowrap">
                <IconCheck />
                {name}
              </span>
            );
          if (i === current)
            return (
              <span key={name} className="mn-stage mn-stage--current whitespace-nowrap" aria-current="step">
                <span className="mn-stage__num">{n}</span>
                {name}
              </span>
            );
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
