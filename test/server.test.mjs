import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  createServer,
  extractOutputText,
  parseAppealResponse,
  parseVerdictResponse,
} from "../server.mjs";

describe("OpenAI response parsing", () => {
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
    output: [
      { type: "reasoning", content: [] },
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(verdict) }],
      },
    ],
  };

  it("extracts output text from a Responses API payload", () => {
    assert.equal(extractOutputText(response), JSON.stringify(verdict));
  });

  it("parses a complete structured verdict", () => {
    assert.deepEqual(parseVerdictResponse(response), verdict);
  });

  it("rejects an incomplete verdict", () => {
    const incomplete = {
      output: [{ content: [{ type: "output_text", text: '{"verdict":"refuse"}' }] }],
    };
    assert.throws(() => parseVerdictResponse(incomplete), /incomplete/);
  });

  it("rejects wrong structured-output types", () => {
    const wrongType = structuredClone(response);
    wrongType.output[1].content[0].text = JSON.stringify({ ...verdict, potential: "91" });
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
    const payload = { output: [{ content: [{ type: "output_text", text: JSON.stringify(ruling) }] }] };
    assert.deepEqual(parseAppealResponse(payload), ruling);
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
    const previousKey = process.env.OPENAI_API_KEY;
    try {
      delete process.env.OPENAI_API_KEY;
      const response = await fetch(`${baseUrl}/api/status`);
      const payload = await response.json();
      assert.equal(response.status, 200);
      assert.equal(payload.aiConfigured, false);
      assert.equal(payload.offlineReady, true);
    } finally {
      if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    }
  });

  it("fails closed when live AI has no server-side key", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    try {
      delete process.env.OPENAI_API_KEY;
      const response = await fetch(`${baseUrl}/api/judge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: "data:image/jpeg;base64,AA==" }),
      });
      const payload = await response.json();
      assert.equal(response.status, 503);
      assert.match(payload.error, /not configured/i);
    } finally {
      if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    }
  });

  it("falls back safely when Trash Court has no server-side key", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    try {
      delete process.env.OPENAI_API_KEY;
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
      if (previousKey) process.env.OPENAI_API_KEY = previousKey;
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
