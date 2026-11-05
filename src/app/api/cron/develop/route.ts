import { runAnalysis } from "@/lib/dev";

// The daily development analysis (vercel.json, crons). Vercel sends the CRON_SECRET it holds;
// without that secret set, the schedule does nothing and the owner dashboard runs it instead.
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Not allowed", { status: 401 });
  try {
    const r = await runAnalysis("en");
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
