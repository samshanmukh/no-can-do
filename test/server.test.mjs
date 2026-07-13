import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  createServer,
  extractOutputText,
  judgeObject,
  parseClientOpenRouterKey,
  parseAppealResponse,
  parseVerdictResponse,
} from "../server.mjs";
import { POST as postVercelAppeal } from "../api/appeal.mjs";
import { GET as getVercelHealth } from "../api/health.mjs";
import { POST as postVercelJudge } from "../api/judge.mjs";
import { GET as getVercelStatus } from "../api/status.mjs";

const TEST_CLIENT_KEY = `sk-or-v1-${"a".repeat(32)}`;

describe("browser OpenRouter credential parsing", () => {
  it("accepts a single well-formed Bearer credential and treats absence as host fallback", () => {
    assert.equal(parseClientOpenRouterKey(undefined), "");
    assert.equal(parseClientOpenRouterKey(""), "");
    assert.equal(parseClientOpenRouterKey(`bEaReR ${TEST_CLIENT_KEY}`), TEST_CLIENT_KEY);
  });

  it("rejects ambiguous or malformed credentials without echoing them", () => {
    const malformed = [
      TEST_CLIENT_KEY,
      `Basic ${TEST_CLIENT_KEY}`,
      `Bearer  ${TEST_CLIENT_KEY}`,
      `Bearer ${TEST_CLIENT_KEY},Bearer ${TEST_CLIENT_KEY}`,
      "Bearer sk-or-v1-short",
      `Bearer sk-or-v1-${"a".repeat(504)}`,
      [TEST_CLIENT_KEY],
    ];
    for (const value of malformed) {
      assert.throws(
        () => parseClientOpenRouterKey(value),
        (error) => error.statusCode === 401
          && /authorization was invalid/i.test(error.message)
          && !error.message.includes(TEST_CLIENT_KEY),
      );
    }
  });
});

describe("OpenRouter response parsing", () => {
  const verdict = {
    object_name: "CUP",
    reframe_name: "TINY VESSEL",
    headline: "STILL TRYING",
    monologue: "Empty is just full of opportunity.",
    verdict: "refuse",
    potential: 91,
    footnote: "Hydration pending.",
  };

  const response = {
    choices: [{ message: { role: "assistant", content: JSON.stringify(verdict) } }],
  };

  it("extracts output text from an OpenRouter chat completion", () => {
    assert.equal(extractOutputText(response), JSON.stringify(verdict));
  });

  it("parses a complete structured verdict", () => {
    assert.deepEqual(parseVerdictResponse(response), verdict);
  });

  it("rejects an incomplete verdict", () => {
    const incomplete = { choices: [{ message: { content: '{"verdict":"refuse"}' } }] };
    assert.throws(() => parseVerdictResponse(incomplete), /incomplete/);
  });

  it("rejects wrong structured-output types", () => {
    const wrongType = structuredClone(response);
    wrongType.choices[0].message.content = JSON.stringify({ ...verdict, potential: "91" });
    assert.throws(() => parseVerdictResponse(wrongType), /invalid potential/);
  });

  it("parses a complete Trash Court ruling", () => {
    const ruling = {
      ruling: "APPEAL DENIED",
      response: "The court finds this cup guilty of having a future.",
      new_job: "TINY PLANTER",
      sentence: "Mentor one succulent.",
      fine: "One sincere apology",
    };
    const payload = { choices: [{ message: { content: JSON.stringify(ruling) } }] };
    assert.deepEqual(parseAppealResponse(payload), ruling);
  });
});

describe("OpenRouter request contract", () => {
  it("prefers a request-scoped key and sends a private, schema-bound multimodal request", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    const previousModel = process.env.OPENROUTER_MODEL;
    const originalFetch = globalThis.fetch;
    let capturedUrl;
    let capturedInit;
    const verdict = {
      object_name: "CUP",
      reframe_name: "TINY VESSEL",
      headline: "STILL TRYING",
      monologue: "Empty is just full of opportunity.",
      verdict: "refuse",
      potential: 91,
      footnote: "Hydration pending.",
    };

    try {
      process.env.OPENROUTER_API_KEY = "test-host-openrouter-key";
      process.env.OPENROUTER_MODEL = "test/vision-model";
      globalThis.fetch = async (url, init) => {
        capturedUrl = url;
        capturedInit = init;
        return new Response(JSON.stringify({
          choices: [{ message: { role: "assistant", content: JSON.stringify(verdict) } }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      };

      const result = await judgeObject({
        image: "data:image/jpeg;base64,AA==",
        hint: "coffee cup",
      }, undefined, { clientApiKey: TEST_CLIENT_KEY });
      const body = JSON.parse(capturedInit.body);

      assert.equal(capturedUrl, "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(capturedInit.headers.Authorization, `Bearer ${TEST_CLIENT_KEY}`);
      assert.equal(capturedInit.headers["X-OpenRouter-Title"], "NO CAN DO");
      assert.equal(body.model, "test/vision-model");
      assert.deepEqual(body.provider, {
        require_parameters: true,
        zdr: true,
        data_collection: "deny",
      });
      assert.deepEqual(body.reasoning, { effort: "minimal", exclude: true });
      assert.equal(body.response_format.type, "json_schema");
      assert.equal(body.response_format.json_schema.strict, true);
      assert.equal(body.messages[1].content[0].type, "text");
      assert.equal(body.messages[1].content[1].type, "image_url");
      assert.equal(body.messages[1].content[1].image_url.url, "data:image/jpeg;base64,AA==");
      assert.deepEqual(result, { ...verdict, model: "test/vision-model" });
    } finally {
      globalThis.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previousKey;
      if (previousModel === undefined) delete process.env.OPENROUTER_MODEL;
      else process.env.OPENROUTER_MODEL = previousModel;
    }
  });

  it("uses the host key when no request-scoped key is supplied", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    const originalFetch = globalThis.fetch;
    let authorization;
    try {
      process.env.OPENROUTER_API_KEY = "test-host-openrouter-key";
      globalThis.fetch = async (_url, init) => {
        authorization = init.headers.Authorization;
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            object_name: "CUP",
            reframe_name: "TINY VESSEL",
            headline: "STILL TRYING",
            monologue: "Empty is just full of opportunity.",
            verdict: "refuse",
            potential: 91,
            footnote: "Hydration pending.",
          }) } }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      };
      await judgeObject({ image: "data:image/jpeg;base64,AA==" });
      assert.equal(authorization, "Bearer test-host-openrouter-key");
    } finally {
      globalThis.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previousKey;
    }
  });

  it("maps request-scoped credential failures without leaking the key", async () => {
    const originalFetch = globalThis.fetch;
    try {
      for (const [status, message] of [
        [401, /rejected that API key/i],
        [402, /needs credits/i],
        [403, /cannot access this model/i],
      ]) {
        globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: "test" } }), {
          status,
          headers: { "Content-Type": "application/json" },
        });
        await assert.rejects(
          judgeObject(
            { image: "data:image/jpeg;base64,AA==" },
            undefined,
            { clientApiKey: TEST_CLIENT_KEY },
          ),
          (error) => error.statusCode === status
            && message.test(error.message)
            && !error.message.includes(TEST_CLIENT_KEY),
        );
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("local server", () => {
  let baseUrl;
  let server;

  before(async () => {
    server = createServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("serves the experience", async () => {
    const response = await fetch(baseUrl);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /NO CAN DO/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
  });

  it("reports a bounded health check", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.service, "no-can-do");
    assert.equal(response.headers.get("cache-control"), "no-store");
  });

  it("reports offline AI status without a key", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    try {
      delete process.env.OPENROUTER_API_KEY;
      const response = await fetch(`${baseUrl}/api/status`);
      const payload = await response.json();
      assert.equal(response.status, 200);
      assert.equal(payload.aiConfigured, false);
      assert.equal(payload.provider, "openrouter");
      assert.equal(payload.offlineReady, true);
    } finally {
      if (previousKey) process.env.OPENROUTER_API_KEY = previousKey;
    }
  });

  it("fails closed when live AI has no server-side key", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    try {
      delete process.env.OPENROUTER_API_KEY;
      const response = await fetch(`${baseUrl}/api/judge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: "data:image/jpeg;base64,AA==" }),
      });
      const payload = await response.json();
      assert.equal(response.status, 503);
      assert.match(payload.error, /not configured/i);
    } finally {
      if (previousKey) process.env.OPENROUTER_API_KEY = previousKey;
    }
  });

  it("falls back safely when Trash Court has no server-side key", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    try {
      delete process.env.OPENROUTER_API_KEY;
      const response = await fetch(`${baseUrl}/api/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict: { object_name: "CUP", reframe_name: "TINY PLANTER", verdict: "refuse" },
          appeal: "It is literally trash.",
        }),
      });
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /not configured/i);
    } finally {
      if (previousKey) process.env.OPENROUTER_API_KEY = previousKey;
    }
  });

  it("rejects non-JSON and cross-origin paid requests", async () => {
    const wrongType = await fetch(`${baseUrl}/api/judge`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}",
    });
    assert.equal(wrongType.status, 415);

    const crossOrigin = await fetch(`${baseUrl}/api/judge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: "{}",
    });
    assert.equal(crossOrigin.status, 403);
  });

  it("validates judgment and appeal inputs before calling AI", async () => {
    const nullBody = await fetch(`${baseUrl}/api/judge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null",
    });
    assert.equal(nullBody.status, 400);

    const fakeImage = await fetch(`${baseUrl}/api/judge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "data:image/svg+xml,<svg/>" }),
    });
    assert.equal(fakeImage.status, 400);

    const emptyAppeal = await fetch(`${baseUrl}/api/appeal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: {}, appeal: "" }),
    });
    assert.equal(emptyAppeal.status, 400);
  });

  it("serves offline assets and handles HEAD without a body", async () => {
    const manifest = await fetch(`${baseUrl}/manifest.webmanifest`);
    assert.equal(manifest.status, 200);
    assert.match(manifest.headers.get("content-type"), /manifest/);

    const head = await fetch(`${baseUrl}/app.js`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  });

  it("returns stable 404 and 405 responses", async () => {
    assert.equal((await fetch(`${baseUrl}/missing.css`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/`, { method: "POST" })).status, 405);
  });

  it("keeps server secrets off the page", async () => {
    const response = await fetch(`${baseUrl}/app.js`);
    const source = await response.text();
    assert.doesNotMatch(source, /process\.env/);
    assert.doesNotMatch(source, /sk-[A-Za-z0-9_-]{12,}/);
  });
});

describe("Vercel function transport", () => {
  it("returns status and health without starting a listener", async () => {
    const statusResponse = getVercelStatus();
    const status = await statusResponse.json();
    assert.equal(statusResponse.status, 200);
    assert.equal(status.provider, "openrouter");
    assert.equal(status.offlineReady, true);
    assert.equal(statusResponse.headers.get("cache-control"), "no-store");

    const healthResponse = getVercelHealth();
    const health = await healthResponse.json();
    assert.deepEqual(health, { ok: true, service: "no-can-do", runtime: "vercel-function" });
    assert.equal(healthResponse.headers.get("x-content-type-options"), "nosniff");
  });

  it("rejects malformed and cross-origin function requests", async () => {
    const malformed = await postVercelJudge(new Request("https://no-can-do.vercel.app/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json}",
    }));
    assert.equal(malformed.status, 400);

    const crossOrigin = await postVercelJudge(new Request("https://no-can-do.vercel.app/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: "{}",
    }));
    assert.equal(crossOrigin.status, 403);
  });

  it("uses a browser key for Vercel judgments without requiring a host key", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    const originalFetch = globalThis.fetch;
    let upstreamAuthorization;
    try {
      delete process.env.OPENROUTER_API_KEY;
      globalThis.fetch = async (_url, init) => {
        upstreamAuthorization = init.headers.Authorization;
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            object_name: "CUP",
            reframe_name: "TINY VESSEL",
            headline: "STILL TRYING",
            monologue: "Empty is just full of opportunity.",
            verdict: "refuse",
            potential: 91,
            footnote: "Hydration pending.",
          }) } }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      };
      const response = await postVercelJudge(new Request("https://no-can-do.vercel.app/api/judge", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_CLIENT_KEY}`,
          "Content-Type": "application/json",
          Origin: "https://no-can-do.vercel.app",
        },
        body: JSON.stringify({ image: "data:image/jpeg;base64,AA==" }),
      }));
      assert.equal(response.status, 200);
      assert.equal(upstreamAuthorization, `Bearer ${TEST_CLIENT_KEY}`);
      assert.equal((await response.json()).object_name, "CUP");
    } finally {
      globalThis.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previousKey;
    }
  });

  it("forwards the browser key for appeals too", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    const originalFetch = globalThis.fetch;
    let upstreamAuthorization;
    try {
      delete process.env.OPENROUTER_API_KEY;
      globalThis.fetch = async (_url, init) => {
        upstreamAuthorization = init.headers.Authorization;
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            ruling: "APPEAL DENIED",
            response: "The court finds this cup guilty of having a future.",
            new_job: "TINY PLANTER",
            sentence: "Mentor one succulent.",
            fine: "One sincere apology",
          }) } }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      };
      const response = await postVercelAppeal(new Request("https://no-can-do.vercel.app/api/appeal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_CLIENT_KEY}`,
          "Content-Type": "application/json",
          Origin: "https://no-can-do.vercel.app",
        },
        body: JSON.stringify({
          verdict: { object_name: "CUP", reframe_name: "TINY PLANTER", verdict: "refuse" },
          appeal: "It is literally trash.",
        }),
      }));
      assert.equal(response.status, 200);
      assert.equal(upstreamAuthorization, `Bearer ${TEST_CLIENT_KEY}`);
      assert.equal((await response.json()).ruling, "APPEAL DENIED");
    } finally {
      globalThis.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previousKey;
    }
  });

  it("rejects an invalid browser credential without falling back to the host key", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    const originalFetch = globalThis.fetch;
    let upstreamCalls = 0;
    try {
      process.env.OPENROUTER_API_KEY = "test-host-openrouter-key";
      globalThis.fetch = async () => {
        upstreamCalls += 1;
        throw new Error("Upstream must not be called for invalid browser credentials.");
      };
      const response = await postVercelJudge(new Request("https://no-can-do.vercel.app/api/judge", {
        method: "POST",
        headers: {
          Authorization: "Bearer definitely-not-an-openrouter-key",
          "Content-Type": "application/json",
          Origin: "https://no-can-do.vercel.app",
        },
        body: JSON.stringify({ image: "data:image/jpeg;base64,AA==" }),
      }));
      const payload = await response.json();
      assert.equal(response.status, 401);
      assert.equal(upstreamCalls, 0);
      assert.match(payload.error, /authorization was invalid/i);
      assert.doesNotMatch(JSON.stringify(payload), /definitely-not-an-openrouter-key/);
    } finally {
      globalThis.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previousKey;
    }
  });

  it("fails closed without an API key in a Vercel invocation", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    try {
      delete process.env.OPENROUTER_API_KEY;
      const response = await postVercelJudge(new Request("https://no-can-do.vercel.app/api/judge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://no-can-do.vercel.app",
        },
        body: JSON.stringify({ image: "data:image/jpeg;base64,AA==" }),
      }));
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /not configured/i);
    } finally {
      if (previousKey) process.env.OPENROUTER_API_KEY = previousKey;
    }
  });
});
