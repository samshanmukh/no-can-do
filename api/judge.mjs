import { handleJudge } from "../lib/vercel-api.mjs";

export function POST(request) {
  return handleJudge(request);
}
