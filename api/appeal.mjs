import { handleAppeal } from "../lib/vercel-api.mjs";

export function POST(request) {
  return handleAppeal(request);
}
