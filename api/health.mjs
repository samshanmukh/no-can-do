import { handleHealth } from "../lib/vercel-api.mjs";

export function GET() {
  return handleHealth();
}
