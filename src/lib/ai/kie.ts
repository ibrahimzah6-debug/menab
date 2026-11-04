import "server-only";

// Kie.ai client. Server only: the key never reaches the browser.
// Docs: https://docs.kie.ai (Market API: createTask, then poll recordInfo).

const BASE = "https://api.kie.ai/api/v1";

// Kie sells credits at $0.005 each (kie.ai/pricing: 17 credits = $0.085).
export const KIE_USD_PER_CREDIT = 0.005;

export class KieError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

function key() {
  const k = process.env.KIE_API_KEY;
  if (!k) throw new KieError(401, "KIE_API_KEY is not set in Vercel");
  return k;
}

type Envelope<T> = { code: number; msg: string; data: T };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new KieError(res.status, `Kie.ai answered with HTTP ${res.status}`);
  }
  // Kie returns HTTP 200 even on failure; the real result is in body.code.
  if (body.code !== 200) throw new KieError(body.code, body.msg || `Kie.ai error ${body.code}`);
  return body.data;
}

export async function createTask(model: string, input: Record<string, unknown>) {
  const data = await call<{ taskId: string }>("/jobs/createTask", {
    method: "POST",
    body: JSON.stringify({ model, input }),
  });
  return data.taskId;
}

export type KieTask = {
  state: "waiting" | "queuing" | "generating" | "success" | "fail";
  resultUrls: string[];
  failMsg: string | null;
  credits: number | null;
  seconds: number | null;
};

export async function getTask(taskId: string): Promise<KieTask> {
  const d = await call<{
    state: KieTask["state"];
    resultJson?: string | { resultUrls?: string[] } | null;
    failMsg?: string | null;
    failCode?: string | number | null;
    creditsConsumed?: number | string | null;
    costTime?: number | null;
    createTime?: number | null;
    completeTime?: number | null;
  }>(`/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);

  let resultUrls: string[] = [];
  if (d.resultJson) {
    try {
      const parsed = typeof d.resultJson === "string" ? JSON.parse(d.resultJson) : d.resultJson;
      resultUrls = Array.isArray(parsed?.resultUrls) ? parsed.resultUrls : [];
    } catch {
      resultUrls = [];
    }
  }
  const credits = d.creditsConsumed == null ? null : Number(d.creditsConsumed);
  const seconds =
    d.createTime && d.completeTime ? Math.max(0, (d.completeTime - d.createTime) / 1000) : null;
  return {
    state: d.state,
    resultUrls,
    failMsg: d.failMsg || (d.failCode ? `Error ${d.failCode}` : null),
    credits: Number.isFinite(credits) ? credits : null,
    seconds,
  };
}

export async function getCredits() {
  const data = await call<number>("/chat/credit");
  return Number(data);
}
