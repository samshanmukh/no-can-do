import {
  appealVerdict,
  DEFAULT_MODEL,
  judgeObject,
  SECURITY_HEADERS,
} from "../server.mjs";

const MAX_BODY_BYTES = 4 * 1024 * 1024;
const API_TIMEOUT_MS = 8_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 40;
const MAX_IN_FLIGHT = 3;

const rateLimits = new Map();
let inFlight = 0;

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function errorWithStatus(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  let requestOrigin;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    throw errorWithStatus("Request URL is invalid.", 400);
  }
  if (origin !== requestOrigin) {
    throw errorWithStatus("Cross-origin judgments are not allowed.", 403);
  }
}

function applyRateLimit(request) {
  const now = Date.now();
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const existing = rateLimits.get(client);
  const bucket = !existing || now - existing.startedAt >= RATE_LIMIT_WINDOW_MS
    ? { count: 0, startedAt: now }
    : existing;
  bucket.count += 1;
  rateLimits.set(client, bucket);
  if (bucket.count > RATE_LIMIT_MAX) {
    throw errorWithStatus("Binjamin needs one emotionally regulated minute.", 429);
  }
  if (rateLimits.size > 1_000) {
    for (const [key, value] of rateLimits) {
      if (now - value.startedAt >= RATE_LIMIT_WINDOW_MS) rateLimits.delete(key);
    }
  }
}

async function readJsonRequest(request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw errorWithStatus("Content-Type must be application/json.", 415);
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw errorWithStatus("Image is too large.", 413);
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw errorWithStatus("Image is too large.", 413);
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw errorWithStatus("Request body must be valid JSON.", 400);
  }
}

async function runPost(request, operation) {
  try {
    assertSameOrigin(request);
    applyRateLimit(request);
    if (inFlight >= MAX_IN_FLIGHT) {
      throw errorWithStatus("The court is at emotional capacity. Try again shortly.", 429);
    }

    inFlight += 1;
    try {
      const body = await readJsonRequest(request);
      const controller = new AbortController();
      const abortUpstream = () => controller.abort();
      if (request.signal.aborted) controller.abort();
      else request.signal.addEventListener("abort", abortUpstream, { once: true });
      const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
      try {
        const payload = await operation(body, controller.signal);
        return jsonResponse(200, payload);
      } finally {
        clearTimeout(timeout);
        request.signal.removeEventListener("abort", abortUpstream);
      }
    } finally {
      inFlight -= 1;
    }
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    console.error(`[${statusCode}] ${error.message}`);
    return jsonResponse(statusCode, {
      error: statusCode === 500 ? "Binjamin is processing a lot emotionally." : error.message,
    });
  }
}

export function handleHealth() {
  return jsonResponse(200, { ok: true, service: "no-can-do", runtime: "vercel-function" });
}

export function handleStatus() {
  return jsonResponse(200, {
    aiConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    provider: "openrouter",
    model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    offlineReady: true,
  });
}

export function handleJudge(request) {
  return runPost(request, judgeObject);
}

export function handleAppeal(request) {
  return runPost(request, appealVerdict);
}
