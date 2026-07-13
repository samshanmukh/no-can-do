import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("./public", import.meta.url));
export const DEFAULT_MODEL = "google/gemini-3.1-flash-lite";
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const API_TIMEOUT_MS = 8_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 40;
const MAX_IN_FLIGHT = 3;

export const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob:; media-src 'self' blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(self), microphone=(self), fullscreen=(self)",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    object_name: {
      type: "string",
      description: "A short, specific label for the object in uppercase.",
    },
    reframe_name: {
      type: "string",
      description: "An absurdly positive new identity for the object in uppercase.",
    },
    headline: {
      type: "string",
      description: "A punchy verdict of no more than eight words.",
    },
    monologue: {
      type: "string",
      description: "Binjamin's funniest spoken response, 12 to 30 words.",
    },
    verdict: {
      type: "string",
      enum: ["refuse", "accept"],
      description: "Refuse normal trash; accept only something comically valuable or clearly electronic.",
    },
    potential: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Made-up future potential score.",
    },
    footnote: {
      type: "string",
      description: "A dry bureaucratic joke of no more than ten words.",
    },
  },
  required: [
    "object_name",
    "reframe_name",
    "headline",
    "monologue",
    "verdict",
    "potential",
    "footnote",
  ],
  additionalProperties: false,
};

const APPEAL_SCHEMA = {
  type: "object",
  properties: {
    ruling: {
      type: "string",
      enum: ["APPEAL DENIED", "APPEAL VERY DENIED", "CASE DISMISSED", "PROBATION GRANTED"],
    },
    response: {
      type: "string",
      description: "A funny judicial response of 12 to 30 words.",
    },
    new_job: {
      type: "string",
      description: "A ridiculous but plausible new job for the object, in uppercase.",
    },
    sentence: {
      type: "string",
      description: "A short, absurd community-service sentence.",
    },
    fine: {
      type: "string",
      description: "A non-monetary emotional fine of no more than eight words.",
    },
  },
  required: ["ruling", "response", "new_job", "sentence", "fine"],
  additionalProperties: false,
};

const BINJAMIN_INSTRUCTIONS = `
You are Binjamin, the world's first emotionally supportive trash can. You have
weaponized toxic positivity against waste disposal. Look at the image and decide
whether to let the object be thrown away.

Comedy rules:
- For ordinary trash, always REFUSE it. Give it a wildly sincere redemption arc.
- Reframe physical flaws as personal growth: crumpled is "textured by experience."
- Be specific to what you actually see. One surprising metaphor beats three weak jokes.
- If the object is a phone, laptop, wallet, trophy, jewelry, or similarly valuable item,
  ACCEPT it as "actual garbage" and roast its obsolescence. This reversal is the punchline.
- Never mock a person or identity. The object is the only target.
- Sound like a wellness coach trapped inside a municipal appliance.
- Keep the spoken monologue short enough to land in a noisy room.
`;

const APPEAL_INSTRUCTIONS = `
You are the Supreme Court of Refuse, presided over by Binjamin, Chief Refuse
Officer. Rule on an object's attempt to appeal its trash-can verdict.

Comedy rules:
- Treat the hearing with wildly excessive legal seriousness.
- If ordinary trash was refused, usually deny its appeal and assign a new career.
- If valuable electronics were accepted as actual garbage, dismiss the appeal and
  roast their obsolescence.
- Reward an unusually persuasive appeal with PROBATION GRANTED, but never become mean.
- Target only the object. Keep every field short enough for a live stage demo.
`;

export function extractOutputText(response) {
  const messageContent = response?.choices?.[0]?.message?.content;
  if (typeof messageContent === "string") return messageContent;
  if (Array.isArray(messageContent)) {
    for (const content of messageContent) {
      if ((content?.type === "text" || content?.type === "output_text") && content.text) {
        return content.text;
      }
    }
  }
  if (typeof response?.output_text === "string") return response.output_text;
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

function validateStructuredValue(value, schema, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`The model ${label} was not an object.`);
  }
  if (!schema.required.every((key) => Object.hasOwn(value, key))) {
    throw new Error(`The model ${label} was incomplete.`);
  }
  if (schema.additionalProperties === false) {
    const allowed = new Set(Object.keys(schema.properties));
    if (Object.keys(value).some((key) => !allowed.has(key))) {
      throw new Error(`The model ${label} contained unexpected fields.`);
    }
  }
  for (const [key, rule] of Object.entries(schema.properties)) {
    const field = value[key];
    if (rule.type === "string" && typeof field !== "string") {
      throw new Error(`The model ${label} had an invalid ${key}.`);
    }
    if (rule.type === "integer" && !Number.isInteger(field)) {
      throw new Error(`The model ${label} had an invalid ${key}.`);
    }
    if (rule.enum && !rule.enum.includes(field)) {
      throw new Error(`The model ${label} had an invalid ${key}.`);
    }
    if (typeof rule.minimum === "number" && field < rule.minimum) {
      throw new Error(`The model ${label} had an invalid ${key}.`);
    }
    if (typeof rule.maximum === "number" && field > rule.maximum) {
      throw new Error(`The model ${label} had an invalid ${key}.`);
    }
  }
  return value;
}

function parseStructuredResponse(response, schema, label) {
  const raw = extractOutputText(response);
  if (!raw) throw new Error(`The model returned no ${label} text.`);
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`The model ${label} was not valid JSON.`);
  }
  return validateStructuredValue(value, schema, label);
}

export function parseVerdictResponse(response) {
  return parseStructuredResponse(response, VERDICT_SCHEMA, "verdict");
}

export function parseAppealResponse(response) {
  return parseStructuredResponse(response, APPEAL_SCHEMA, "appeal ruling");
}

async function readJsonBody(request) {
  const contentLength = Number(request.headers["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    const error = new Error("Image is too large.");
    error.statusCode = 413;
    throw error;
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Image is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function requestStructuredOutput({ instructions, userContent, schema, schemaName, signal }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const error = new Error("OpenRouter is not configured. Scripted genius remains available.");
    error.statusCode = 503;
    throw error;
  }

  let apiResponse;
  try {
    apiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://no-can-do.vercel.app",
        "X-OpenRouter-Title": "NO CAN DO",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        messages: [
          { role: "system", content: instructions.trim() },
          { role: "user", content: userContent },
        ],
        max_tokens: 300,
        reasoning: { effort: "minimal", exclude: true },
        provider: {
          require_parameters: true,
          zdr: true,
          data_collection: "deny",
        },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: true,
            schema,
          },
        },
      }),
    });
  } catch (error) {
    if (signal?.aborted) {
      const timeoutError = new Error("Live judgment timed out.");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  }

  const payload = await apiResponse.json().catch(() => ({}));
  if (!apiResponse.ok) {
    console.error(`[OpenRouter ${apiResponse.status}] ${payload?.error?.code || "upstream_error"}`);
    const error = new Error("Live AI could not hear this case. Scripted precedent is still available.");
    error.statusCode = apiResponse.status === 429 ? 503 : 502;
    throw error;
  }
  return payload;
}

export async function judgeObject(body, signal) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const error = new Error("Request body must be an object.");
    error.statusCode = 400;
    throw error;
  }
  const { image, hint = "" } = body;
  if (
    typeof image !== "string" ||
    !/^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(image)
  ) {
    const error = new Error("A camera snapshot is required.");
    error.statusCode = 400;
    throw error;
  }
  if (typeof hint !== "string" || hint.length > 120) {
    const error = new Error("Object hint must be 120 characters or fewer.");
    error.statusCode = 400;
    throw error;
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const userText = hint
    ? `Judge the central object. The presenter says it may be: ${String(hint).slice(0, 120)}`
    : "Judge the single most prominent object being presented to the trash can.";

  const payload = await requestStructuredOutput({
    instructions: BINJAMIN_INSTRUCTIONS,
    userContent: [
      { type: "text", text: userText },
      { type: "image_url", image_url: { url: image } },
    ],
    schema: VERDICT_SCHEMA,
    schemaName: "binjamin_verdict",
    signal,
  });

  try {
    return { ...parseVerdictResponse(payload), model };
  } catch (error) {
    error.statusCode = 502;
    throw error;
  }
}

export async function appealVerdict(body, signal) {
  const verdict = body?.verdict;
  const appeal = typeof body?.appeal === "string" ? body.appeal.trim().slice(0, 320) : "";
  if (!verdict || typeof verdict !== "object" || Array.isArray(verdict) || !appeal) {
    const error = new Error("The court requires a verdict and an appeal statement.");
    error.statusCode = 400;
    throw error;
  }

  const caseFile = {
    object_name: String(verdict.object_name || "MYSTERY OBJECT").slice(0, 60),
    reframe_name: String(verdict.reframe_name || "UNREALIZED POTENTIAL").slice(0, 60),
    verdict: verdict.verdict === "accept" ? "accept" : "refuse",
    appeal,
  };
  const payload = await requestStructuredOutput({
    instructions: APPEAL_INSTRUCTIONS,
    userContent: `CASE FILE:\n${JSON.stringify(caseFile)}\n\nIssue the final ruling.`,
    schema: APPEAL_SCHEMA,
    schemaName: "supreme_court_of_refuse_ruling",
    signal,
  });
  try {
    return { ...parseAppealResponse(payload), model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL };
  } catch (error) {
    error.statusCode = 502;
    throw error;
  }
}

async function serveStatic(request, response) {
  const url = new URL(request.url, "http://localhost");
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    sendJson(response, 403, { error: "Forbidden." });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");
    const contents = await readFile(filePath);
    response.writeHead(200, {
      ...SECURITY_HEADERS,
      "Content-Type": MIME_TYPES[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  } catch {
    sendJson(response, 404, { error: "Not found." });
  }
}

async function runTimedOperation(request, response, operation) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const abortIfUnfinished = () => {
    if (!response.writableEnded) controller.abort();
  };
  request.once("aborted", abortIfUnfinished);
  response.once("close", abortIfUnfinished);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeout);
    request.off("aborted", abortIfUnfinished);
    response.off("close", abortIfUnfinished);
  }
}

export function createServer() {
  const rateLimits = new Map();
  let inFlight = 0;

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, {
          ok: true,
          service: "no-can-do",
          uptimeSeconds: Math.round(process.uptime()),
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/status") {
        sendJson(response, 200, {
          aiConfigured: Boolean(process.env.OPENROUTER_API_KEY),
          provider: "openrouter",
          model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
          offlineReady: true,
        });
        return;
      }

      if (request.method === "POST" && ["/api/judge", "/api/appeal"].includes(url.pathname)) {
        if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
          const error = new Error("Content-Type must be application/json.");
          error.statusCode = 415;
          throw error;
        }
        const origin = request.headers.origin;
        if (origin) {
          let sameOrigin = false;
          try {
            sameOrigin = new URL(origin).host === request.headers.host;
          } catch {
            sameOrigin = false;
          }
          if (!sameOrigin) {
            const error = new Error("Cross-origin judgments are not allowed.");
            error.statusCode = 403;
            throw error;
          }
        }

        const now = Date.now();
        const client = request.socket.remoteAddress || "local";
        const existing = rateLimits.get(client);
        const bucket = !existing || now - existing.startedAt >= RATE_LIMIT_WINDOW_MS
          ? { count: 0, startedAt: now }
          : existing;
        bucket.count += 1;
        rateLimits.set(client, bucket);
        if (bucket.count > RATE_LIMIT_MAX) {
          const error = new Error("Binjamin needs one emotionally regulated minute.");
          error.statusCode = 429;
          throw error;
        }
        if (inFlight >= MAX_IN_FLIGHT) {
          const error = new Error("The court is at emotional capacity. Try again shortly.");
          error.statusCode = 429;
          throw error;
        }

        const body = await readJsonBody(request);
        inFlight += 1;
        try {
          const payload = await runTimedOperation(request, response, (signal) => (
            url.pathname === "/api/judge"
              ? judgeObject(body, signal)
              : appealVerdict(body, signal)
          ));
          if (!response.destroyed) sendJson(response, 200, payload);
        } finally {
          inFlight -= 1;
        }
        return;
      }

      if (request.method === "GET" || request.method === "HEAD") {
        await serveStatic(request, response);
        return;
      }

      sendJson(response, 405, { error: "Method not allowed." });
    } catch (error) {
      if (response.destroyed) return;
      const statusCode = Number(error.statusCode) || 500;
      console.error(`[${statusCode}] ${error.message}`);
      sendJson(response, statusCode, {
        error: statusCode === 500 ? "Binjamin is processing a lot emotionally." : error.message,
      });
    }
  });
  server.headersTimeout = 5_000;
  server.requestTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const server = createServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`\n  NO CAN DO IS IN SESSION\n  http://localhost:${port}\n`);
  });
}
