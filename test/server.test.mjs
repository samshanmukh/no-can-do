import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import { AI_PROVIDERS } from "../lib/ai-providers.mjs";
import {
  createServer,
  extractOutputText,
  getPublicAiStatus,
  judgeObject,
  parseClientAiCredential,
  parseClientOpenRouterKey,
  parseAppealResponse,
  parseVerdictResponse,
} from "../server.mjs";
import { POST as postVercelAppeal } from "../api/appeal.mjs";
import { GET as getVercelHealth } from "../api/health.mjs";
import { POST as postVercelJudge } from "../api/judge.mjs";
import { GET as getVercelStatus } from "../api/status.mjs";

const TEST_KEYS = Object.freeze({
  openrouter: `sk-or-v1-${"a".repeat(32)}`,
  openai: `sk-proj-${"b".repeat(32)}`,
  xai: `xai-${"c".repeat(32)}`,
  anthropic: `sk-ant-api03-${"d".repeat(32)}`,
});
const TEST_CLIENT_KEY = TEST_KEYS.openrouter;
const NO_HOST_AI_ENV = Object.freeze({
  ALLOW_HOST_AI: undefined,
  AI_PROVIDER: undefined,
  OPENROUTER_API_KEY: undefined,
  OPENAI_API_KEY: undefined,
  XAI_API_KEY: undefined,
  ANTHROPIC_API_KEY: undefined,
});

async function withEnvironment(changes, operation) {
  const previous = Object.fromEntries(
    Object.keys(changes).map((key) => [key, process.env[key]]),
  );
  try {
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return await operation();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("browser AI credential parsing", () => {
  it("accepts each supported provider and treats absence as host fallback", () => {
    assert.equal(parseClientAiCredential(), null);
    for (const [provider, apiKey] of Object.entries(TEST_KEYS)) {
      assert.deepEqual(
        parseClientAiCredential({ authorization: `bEaReR ${apiKey}`, provider }),
        { provider, apiKey },
      );
    }
  });

  it("reports safe host readiness without exposing credentials", () => {
    const status = getPublicAiStatus({
      ALLOW_HOST_AI: "true",
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "host-secret-openai",
      OPENAI_MODEL: "host-openai-model",
      ANTHROPIC_API_KEY: "host-secret-anthropic",
    });
    assert.equal(status.aiConfigured, true);
    assert.equal(status.provider, "openai");
    assert.equal(status.model, "host-openai-model");
    assert.equal(status.configurationValid, true);
    assert.doesNotMatch(JSON.stringify(status), /host-secret/);
  });

  it("keeps host funding off by default and fails closed on an unknown provider", () => {
    assert.deepEqual(
      getPublicAiStatus({ OPENROUTER_API_KEY: "host-secret-openrouter" }),
      {
        aiConfigured: false,
        provider: "openrouter",
        model: AI_PROVIDERS.openrouter.defaultModel,
        configurationValid: true,
        offlineReady: true,
      },
    );
    const invalid = getPublicAiStatus({
      ALLOW_HOST_AI: "true",
      AI_PROVIDER: "anthorpic",
      OPENROUTER_API_KEY: "host-secret-openrouter",
      ANTHROPIC_API_KEY: "host-secret-anthropic",
    });
    assert.equal(invalid.aiConfigured, false);
    assert.equal(invalid.configurationValid, false);
    assert.equal(invalid.provider, "openrouter");
  });

  it("keeps provider-less OpenRouter credentials compatible for already-open tabs", () => {
    assert.equal(parseClientOpenRouterKey(undefined), "");
    assert.equal(parseClientOpenRouterKey(""), "");
    assert.equal(parseClientOpenRouterKey(`bEaReR ${TEST_CLIENT_KEY}`), TEST_CLIENT_KEY);
  });

  it("rejects ambiguous, mismatched, or unsupported credentials without echoing them", () => {
    const malformed = [
      { authorization: TEST_CLIENT_KEY, provider: "openrouter" },
      { authorization: `Basic ${TEST_CLIENT_KEY}`, provider: "openrouter" },
      { authorization: `Bearer  ${TEST_CLIENT_KEY}`, provider: "openrouter" },
      { authorization: `Bearer ${TEST_CLIENT_KEY},Bearer ${TEST_CLIENT_KEY}`, provider: "openrouter" },
      { authorization: "Bearer sk-or-v1-short", provider: "openrouter" },
      { authorization: `Bearer sk-or-v1-${"a".repeat(504)}`, provider: "openrouter" },
      { authorization: [TEST_CLIENT_KEY], provider: "openrouter" },
      { authorization: `Bearer ${TEST_KEYS.openai}`, provider: "anthropic" },
    ];
    for (const value of malformed) {
      assert.throws(
        () => parseClientAiCredential(value),
        (error) => error.statusCode === 401
          && !error.message.includes(TEST_CLIENT_KEY),
      );
    }
    assert.throws(
      () => parseClientAiCredential({ authorization: `Bearer ${TEST_CLIENT_KEY}`, provider: "evil" }),
      (error) => error.statusCode === 400 && /not supported/i.test(error.message),
    );
    assert.throws(
      () => parseClientAiCredential({ provider: "openai" }),
      (error) => error.statusCode === 401,
    );
  });
});

describe("provider response parsing", () => {
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

  it("extracts output text from Responses API and Anthropic payloads", () => {
    const json = JSON.stringify(verdict);
    assert.equal(extractOutputText({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: json }] }],
    }), json);
    assert.equal(extractOutputText({
      stop_reason: "end_turn",
      content: [{ type: "text", text: json }],
    }), json);
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

  it("canonicalizes provider enum capitalization before local validation", () => {
    const mixedCase = structuredClone(response);
    mixedCase.choices[0].message.content = JSON.stringify({ ...verdict, verdict: "REFUSE" });
    assert.equal(parseVerdictResponse(mixedCase).verdict, "refuse");
  });
});

describe("OpenRouter request contract", () => {
  it("prefers a request-scoped key, ignores host model overrides, and sends a private schema-bound request", async () => {
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
      assert.equal(body.model, AI_PROVIDERS.openrouter.defaultModel);
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
      assert.deepEqual(result, {
        ...verdict,
        model: AI_PROVIDERS.openrouter.defaultModel,
        provider: "openrouter",
      });
    } finally {
      globalThis.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previousKey;
      if (previousModel === undefined) delete process.env.OPENROUTER_MODEL;
      else process.env.OPENROUTER_MODEL = previousModel;
    }
  });

  it("uses the host key when no request-scoped key is supplied", async () => {
    const previousAllowHostAi = process.env.ALLOW_HOST_AI;
    const previousKey = process.env.OPENROUTER_API_KEY;
    const previousModel = process.env.OPENROUTER_MODEL;
    const originalFetch = globalThis.fetch;
    let authorization;
    let model;
    try {
      process.env.ALLOW_HOST_AI = "true";
      process.env.OPENROUTER_API_KEY = "test-host-openrouter-key";
      process.env.OPENROUTER_MODEL = "test/host-vision-model";
      globalThis.fetch = async (_url, init) => {
        authorization = init.headers.Authorization;
        model = JSON.parse(init.body).model;
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
      assert.equal(model, "test/host-vision-model");
    } finally {
      globalThis.fetch = originalFetch;
      if (previousAllowHostAi === undefined) delete process.env.ALLOW_HOST_AI;
      else process.env.ALLOW_HOST_AI = previousAllowHostAi;
      if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previousKey;
      if (previousModel === undefined) delete process.env.OPENROUTER_MODEL;
      else process.env.OPENROUTER_MODEL = previousModel;
    }
  });

  it("does not spend a configured host key without explicit host funding", async () => {
    const originalFetch = globalThis.fetch;
    let upstreamCalls = 0;
    try {
      await withEnvironment({
        ...NO_HOST_AI_ENV,
        OPENROUTER_API_KEY: "test-host-openrouter-key",
      }, async () => {
        globalThis.fetch = async () => {
          upstreamCalls += 1;
          throw new Error("Host key must remain unused.");
        };
        await assert.rejects(
          judgeObject({ image: "data:image/jpeg;base64,AA==" }),
          (error) => error.statusCode === 503 && /not configured/i.test(error.message),
        );
      });
      await withEnvironment({
        ...NO_HOST_AI_ENV,
        ALLOW_HOST_AI: "true",
        AI_PROVIDER: "anthorpic",
        OPENROUTER_API_KEY: "test-host-openrouter-key",
        ANTHROPIC_API_KEY: "test-host-anthropic-key",
      }, async () => {
        await assert.rejects(
          judgeObject({ image: "data:image/jpeg;base64,AA==" }),
          (error) => error.statusCode === 503 && /not supported/i.test(error.message),
        );
      });
      assert.equal(upstreamCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("maps request-scoped credential failures without leaking the key", async () => {
    const originalFetch = globalThis.fetch;
    try {
      for (const [status, message] of [
        [401, /rejected that API key/i],
        [402, /needs credits/i],
        [403, /cannot use this model/i],
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

describe("direct provider request contracts", () => {
  const verdict = {
    object_name: "CUP",
    reframe_name: "TINY VESSEL",
    headline: "STILL TRYING",
    monologue: "Empty is just full of opportunity.",
    verdict: "refuse",
    potential: 91,
    footnote: "Hydration pending.",
  };

  for (const config of [
    {
      provider: "openai",
      envModel: "OPENAI_MODEL",
      defaultModel: AI_PROVIDERS.openai.defaultModel,
      endpoint: "https://api.openai.com/v1/responses",
    },
    {
      provider: "xai",
      envModel: "XAI_MODEL",
      defaultModel: AI_PROVIDERS.xai.defaultModel,
      endpoint: "https://api.x.ai/v1/responses",
    },
  ]) {
    it(`sends the ${config.provider} Responses API contract without host model steering`, async () => {
      const originalFetch = globalThis.fetch;
      let capturedUrl;
      let capturedInit;
      try {
        await withEnvironment({ [config.envModel]: "host-only-expensive-model" }, async () => {
          globalThis.fetch = async (url, init) => {
            capturedUrl = url;
            capturedInit = init;
            return new Response(JSON.stringify({
              status: "completed",
              output: [{ content: [{ type: "output_text", text: JSON.stringify(verdict) }] }],
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          };
          const result = await judgeObject(
            { image: "data:image/jpeg;base64,AA==", hint: "coffee cup" },
            undefined,
            { clientCredential: { provider: config.provider, apiKey: TEST_KEYS[config.provider] } },
          );
          const body = JSON.parse(capturedInit.body);
          assert.equal(capturedUrl, config.endpoint);
          assert.equal(capturedInit.headers.Authorization, `Bearer ${TEST_KEYS[config.provider]}`);
          assert.equal(body.model, config.defaultModel);
          assert.equal(body.store, false);
          assert.deepEqual(body.reasoning, { effort: "none" });
          assert.equal(body.input[0].role, "system");
          assert.equal(body.input[1].content[0].type, "input_image");
          assert.equal(body.input[1].content[0].image_url, "data:image/jpeg;base64,AA==");
          assert.equal(body.input[1].content[0].detail, "low");
          assert.equal(body.input[1].content[1].type, "input_text");
          assert.equal(body.text.format.type, "json_schema");
          assert.equal(body.text.format.strict, true);
          assert.deepEqual(result, {
            ...verdict,
            model: config.defaultModel,
            provider: config.provider,
          });
        });
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  }

  it("sends Anthropic's native image, auth, and structured-output contract", async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl;
    let capturedInit;
    try {
      await withEnvironment({ ANTHROPIC_MODEL: "host-only-expensive-model" }, async () => {
        globalThis.fetch = async (url, init) => {
          capturedUrl = url;
          capturedInit = init;
          return new Response(JSON.stringify({
            stop_reason: "end_turn",
            content: [{ type: "text", text: JSON.stringify({ ...verdict, verdict: "REFUSE" }) }],
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        };
        const result = await judgeObject(
          { image: "data:image/jpg;base64,AA==", hint: "coffee cup" },
          undefined,
          { clientCredential: { provider: "anthropic", apiKey: TEST_KEYS.anthropic } },
        );
        const body = JSON.parse(capturedInit.body);
        assert.equal(capturedUrl, "https://api.anthropic.com/v1/messages");
        assert.equal(capturedInit.headers["x-api-key"], TEST_KEYS.anthropic);
        assert.equal(capturedInit.headers.Authorization, undefined);
        assert.equal(capturedInit.headers["anthropic-version"], "2023-06-01");
        assert.equal(body.model, AI_PROVIDERS.anthropic.defaultModel);
        assert.equal(body.system.includes("emotionally supportive trash can"), true);
        assert.equal(body.messages[0].content[0].type, "image");
        assert.equal(body.messages[0].content[0].source.media_type, "image/jpeg");
        assert.equal(body.messages[0].content[0].source.data, "AA==");
        assert.equal(body.messages[0].content[1].type, "text");
        assert.equal(body.output_config.format.type, "json_schema");
        assert.equal(body.output_config.format.schema.properties.potential.minimum, undefined);
        assert.equal(body.output_config.format.schema.properties.potential.maximum, undefined);
        assert.deepEqual(result, {
          ...verdict,
          model: AI_PROVIDERS.anthropic.defaultModel,
          provider: "anthropic",
        });
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects incomplete Responses and Anthropic outputs before local parsing", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => new Response(JSON.stringify({ status: "incomplete", output: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
      await assert.rejects(
        judgeObject(
          { image: "data:image/jpeg;base64,AA==" },
          undefined,
          { clientCredential: { provider: "openai", apiKey: TEST_KEYS.openai } },
        ),
        (error) => error.statusCode === 502 && /did not complete/i.test(error.message),
      );

      for (const stopReason of ["max_tokens", "refusal"]) {
        globalThis.fetch = async () => new Response(JSON.stringify({ stop_reason: stopReason, content: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
        await assert.rejects(
          judgeObject(
            { image: "data:image/jpeg;base64,AA==" },
            undefined,
            { clientCredential: { provider: "anthropic", apiKey: TEST_KEYS.anthropic } },
          ),
          (error) => error.statusCode === 502 && /did not complete/i.test(error.message),
        );
      }

      let webpUpstreamCalls = 0;
      globalThis.fetch = async () => {
        webpUpstreamCalls += 1;
        throw new Error("xAI WebP evidence must be rejected locally.");
      };
      await assert.rejects(
        judgeObject(
          { image: "data:image/webp;base64,AA==" },
          undefined,
          { clientCredential: { provider: "xai", apiKey: TEST_KEYS.xai } },
        ),
        (error) => error.statusCode === 415 && /JPEG or PNG/i.test(error.message),
      );
      assert.equal(webpUpstreamCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("browser deployment contract", () => {
  it("keeps the provider catalog and memory-only promise aligned", async () => {
    const [app, demo, readme, environment, serviceWorker] = await Promise.all([
      readFile(new URL("../public/app.js", import.meta.url), "utf8"),
      readFile(new URL("../public/demo.html", import.meta.url), "utf8"),
      readFile(new URL("../README.md", import.meta.url), "utf8"),
      readFile(new URL("../.env.example", import.meta.url), "utf8"),
      readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    ]);
    for (const [provider, profile] of Object.entries(AI_PROVIDERS)) {
      assert.match(app, new RegExp(profile.defaultModel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(readme, new RegExp(profile.defaultModel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(environment, new RegExp(profile.defaultModel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(demo, new RegExp(`value=["']${provider}["']`));
    }
    assert.equal((app.match(/localStorage\.setItem/g) || []).length, 1);
    assert.match(app, /localStorage\.setItem\(HISTORY_KEY/);
    assert.match(serviceWorker, /no-can-do-v7/);
    assert.match(serviceWorker, /"\/demo\.html"/);
    assert.match(serviceWorker, /"\/landing\.css"/);
    assert.match(serviceWorker, /request\.method !== "GET"/);
    assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
    assert.match(serviceWorker, /event\.request\.mode === "navigate"/);
  });

  it("keeps the marketing page isolated, accessible, and discoverable", async () => {
    const [landing, demo, landingCss, landingJs, manifest, robots, sitemap] = await Promise.all([
      readFile(new URL("../public/index.html", import.meta.url), "utf8"),
      readFile(new URL("../public/demo.html", import.meta.url), "utf8"),
      readFile(new URL("../public/landing.css", import.meta.url), "utf8"),
      readFile(new URL("../public/landing.js", import.meta.url), "utf8"),
      readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
      readFile(new URL("../public/robots.txt", import.meta.url), "utf8"),
      readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8"),
    ]);
    assert.equal((landing.match(/<h1\b/g) || []).length, 1);
    assert.match(landing, /href="#landing-main"/);
    assert.match(landing, /<main id="landing-main" tabindex="-1">/);
    assert.match(landing, /href="\/demo\.html"/);
    assert.match(landing, /rel="canonical" href="https:\/\/no-can-do\.vercel\.app\/"/);
    assert.match(landing, /property="og:title"/);
    assert.match(landing, /property="og:image" content="https:\/\/no-can-do\.vercel\.app\/social-card\.jpg"/);
    assert.match(landing, /property="og:image:alt"/);
    assert.match(landing, /name="twitter:card"/);
    assert.match(landing, /name="twitter:image"/);
    assert.match(landing, /src="\/landing\.js"/);
    assert.doesNotMatch(landing, /src="\/app\.js"/);
    assert.match(demo, /rel="canonical" href="https:\/\/no-can-do\.vercel\.app\/demo\.html"/);
    assert.match(demo, /name="robots" content="noindex,follow"/);
    assert.match(demo, /href="\/" aria-label="NO CAN DO landing page"/);
    assert.match(demo, /src="\/app\.js"/);
    assert.match(landingCss, /a:focus-visible/);
    assert.match(landingCss, /prefers-reduced-motion: reduce/);
    assert.match(landingJs, /serviceWorker\.register\("\/sw\.js"\)/);
    const parsedManifest = JSON.parse(manifest);
    assert.equal(parsedManifest.id, "/");
    assert.equal(parsedManifest.scope, "/");
    assert.equal(parsedManifest.start_url, "/demo.html");
    assert.match(robots, /Sitemap: https:\/\/no-can-do\.vercel\.app\/sitemap\.xml/);
    assert.match(sitemap, /<loc>https:\/\/no-can-do\.vercel\.app\/<\/loc>/);
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

  it("serves the landing page and isolated interactive demo", async () => {
    const [landingResponse, demoResponse, landingHead, demoHead] = await Promise.all([
      fetch(baseUrl),
      fetch(`${baseUrl}/demo.html`),
      fetch(baseUrl, { method: "HEAD" }),
      fetch(`${baseUrl}/demo.html`, { method: "HEAD" }),
    ]);
    const [landing, demo] = await Promise.all([landingResponse.text(), demoResponse.text()]);
    assert.equal(landingResponse.status, 200);
    assert.equal(demoResponse.status, 200);
    assert.match(landingResponse.headers.get("content-type"), /text\/html/);
    assert.match(demoResponse.headers.get("content-type"), /text\/html/);
    assert.match(landing, /THE TRASH CAN/);
    assert.match(landing, /href="\/demo\.html"/);
    assert.doesNotMatch(landing, /src="\/app\.js"/);
    assert.match(demo, /PICK BINJAMIN'S BRAIN/);
    assert.match(demo, /src="\/app\.js"/);
    assert.equal(landingHead.status, 200);
    assert.equal(demoHead.status, 200);
    assert.equal(await landingHead.text(), "");
    assert.equal(await demoHead.text(), "");
    assert.equal(landingResponse.headers.get("x-content-type-options"), "nosniff");
    assert.match(landingResponse.headers.get("content-security-policy"), /default-src 'self'/);
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
    await withEnvironment(NO_HOST_AI_ENV, async () => {
      const response = await fetch(`${baseUrl}/api/status`);
      const payload = await response.json();
      assert.equal(response.status, 200);
      assert.equal(payload.aiConfigured, false);
      assert.equal(payload.provider, "openrouter");
      assert.equal(payload.offlineReady, true);
    });
  });

  it("fails closed when live AI has no server-side key", async () => {
    await withEnvironment(NO_HOST_AI_ENV, async () => {
      const response = await fetch(`${baseUrl}/api/judge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: "data:image/jpeg;base64,AA==" }),
      });
      const payload = await response.json();
      assert.equal(response.status, 503);
      assert.match(payload.error, /not configured/i);
    });
  });

  it("falls back safely when Trash Court has no server-side key", async () => {
    await withEnvironment(NO_HOST_AI_ENV, async () => {
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
    });
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

  it("routes every browser provider through the local transport", async () => {
    const originalFetch = globalThis.fetch;
    const verdict = {
      object_name: "CUP",
      reframe_name: "TINY VESSEL",
      headline: "STILL TRYING",
      monologue: "Empty is just full of opportunity.",
      verdict: "refuse",
      potential: 91,
      footnote: "Hydration pending.",
    };
    const providerCases = [
      ["openrouter", "https://openrouter.ai/api/v1/chat/completions"],
      ["openai", "https://api.openai.com/v1/responses"],
      ["xai", "https://api.x.ai/v1/responses"],
      ["anthropic", "https://api.anthropic.com/v1/messages"],
    ];
    try {
      for (const [provider, expectedUrl] of providerCases) {
        let upstreamUrl;
        globalThis.fetch = async (url) => {
          upstreamUrl = String(url);
          const payload = provider === "openrouter"
            ? { choices: [{ message: { content: JSON.stringify(verdict) } }] }
            : provider === "anthropic"
              ? { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(verdict) }] }
              : { status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(verdict) }] }] };
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        };
        const response = await originalFetch(`${baseUrl}/api/judge`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${TEST_KEYS[provider]}`,
            "Content-Type": "application/json",
            "X-NCD-AI-Provider": provider,
          },
          body: JSON.stringify({ image: "data:image/jpeg;base64,AA==" }),
        });
        const payload = await response.json();
        assert.equal(response.status, 200);
        assert.equal(upstreamUrl, expectedUrl);
        assert.equal(payload.provider, provider);
        assert.equal(payload.model, AI_PROVIDERS[provider].defaultModel);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("serves offline assets and handles HEAD without a body", async () => {
    const [manifest, landingCss, landingJs, robots, sitemap, socialCard] = await Promise.all([
      fetch(`${baseUrl}/manifest.webmanifest`),
      fetch(`${baseUrl}/landing.css`),
      fetch(`${baseUrl}/landing.js`),
      fetch(`${baseUrl}/robots.txt`),
      fetch(`${baseUrl}/sitemap.xml`),
      fetch(`${baseUrl}/social-card.jpg`),
    ]);
    assert.equal(manifest.status, 200);
    assert.match(manifest.headers.get("content-type"), /manifest/);
    assert.equal(landingCss.status, 200);
    assert.match(landingCss.headers.get("content-type"), /text\/css/);
    assert.equal(landingJs.status, 200);
    assert.match(landingJs.headers.get("content-type"), /javascript/);
    assert.equal(robots.status, 200);
    assert.match(robots.headers.get("content-type"), /text\/plain/);
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get("content-type"), /(?:xml|octet-stream)/);
    assert.equal(socialCard.status, 200);
    assert.match(socialCard.headers.get("content-type"), /image\/jpeg/);

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
    assert.doesNotMatch(source, /xai-[A-Za-z0-9_-]{12,}/);
  });
});

describe("Vercel function transport", () => {
  it("returns status and health without starting a listener", async () => {
    await withEnvironment(NO_HOST_AI_ENV, async () => {
      const statusResponse = getVercelStatus();
      const status = await statusResponse.json();
      assert.equal(statusResponse.status, 200);
      assert.equal(status.provider, "openrouter");
      assert.equal(status.offlineReady, true);
      assert.equal(statusResponse.headers.get("cache-control"), "no-store");
    });

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

  it("routes a selected xAI browser key through a Vercel judgment", async () => {
    const previousKey = process.env.XAI_API_KEY;
    const originalFetch = globalThis.fetch;
    let upstreamAuthorization;
    let upstreamUrl;
    try {
      delete process.env.XAI_API_KEY;
      globalThis.fetch = async (url, init) => {
        upstreamUrl = url;
        upstreamAuthorization = init.headers.Authorization;
        return new Response(JSON.stringify({
          status: "completed",
          output: [{ content: [{ type: "output_text", text: JSON.stringify({
              object_name: "CUP",
              reframe_name: "TINY VESSEL",
              headline: "STILL TRYING",
              monologue: "Empty is just full of opportunity.",
              verdict: "refuse",
              potential: 91,
              footnote: "Hydration pending.",
            }) }] }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      };
      const response = await postVercelJudge(new Request("https://no-can-do.vercel.app/api/judge", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEYS.xai}`,
          "Content-Type": "application/json",
          Origin: "https://no-can-do.vercel.app",
          "X-NCD-AI-Provider": "xai",
        },
        body: JSON.stringify({ image: "data:image/jpeg;base64,AA==" }),
      }));
      assert.equal(response.status, 200);
      assert.equal(upstreamUrl, "https://api.x.ai/v1/responses");
      assert.equal(upstreamAuthorization, `Bearer ${TEST_KEYS.xai}`);
      const payload = await response.json();
      assert.equal(payload.object_name, "CUP");
      assert.equal(payload.provider, "xai");
    } finally {
      globalThis.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = previousKey;
    }
  });

  it("routes a selected Anthropic browser key through a Vercel appeal", async () => {
    const previousKey = process.env.ANTHROPIC_API_KEY;
    const originalFetch = globalThis.fetch;
    let upstreamApiKey;
    let upstreamUrl;
    try {
      delete process.env.ANTHROPIC_API_KEY;
      globalThis.fetch = async (url, init) => {
        upstreamUrl = url;
        upstreamApiKey = init.headers["x-api-key"];
        return new Response(JSON.stringify({
          stop_reason: "end_turn",
          content: [{ type: "text", text: JSON.stringify({
              ruling: "APPEAL DENIED",
              response: "The court finds this cup guilty of having a future.",
              new_job: "TINY PLANTER",
              sentence: "Mentor one succulent.",
              fine: "One sincere apology",
            }) }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      };
      const response = await postVercelAppeal(new Request("https://no-can-do.vercel.app/api/appeal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TEST_KEYS.anthropic}`,
          "Content-Type": "application/json",
          Origin: "https://no-can-do.vercel.app",
          "X-NCD-AI-Provider": "anthropic",
        },
        body: JSON.stringify({
          verdict: { object_name: "CUP", reframe_name: "TINY PLANTER", verdict: "refuse" },
          appeal: "It is literally trash.",
        }),
      }));
      assert.equal(response.status, 200);
      assert.equal(upstreamUrl, "https://api.anthropic.com/v1/messages");
      assert.equal(upstreamApiKey, TEST_KEYS.anthropic);
      const payload = await response.json();
      assert.equal(payload.ruling, "APPEAL DENIED");
      assert.equal(payload.provider, "anthropic");
    } finally {
      globalThis.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = previousKey;
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
    await withEnvironment(NO_HOST_AI_ENV, async () => {
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
    });
  });
});
