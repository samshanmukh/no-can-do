import { handleStatus } from "../lib/vercel-api.mjs";

export function GET() {
  return handleStatus();
}
