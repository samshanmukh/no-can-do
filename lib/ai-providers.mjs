export const DEFAULT_PROVIDER = "openrouter";

export const CLIENT_AI_HEADERS = Object.freeze({
  authorization: "authorization",
  provider: "x-ncd-ai-provider",
});

const TOKEN_PATTERN = /^[A-Za-z0-9._~+/-]+=*$/;

export const AI_PROVIDERS = Object.freeze({
  openrouter: Object.freeze({
    id: "openrouter",
    label: "OpenRouter",
    product: "OPENROUTER",
    envKey: "OPENROUTER_API_KEY",
    envModel: "OPENROUTER_MODEL",
    defaultModel: "google/gemini-3.1-flash-lite",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    keyPrefix: "sk-or-v1-",
  }),
  openai: Object.freeze({
    id: "openai",
    label: "OpenAI",
    product: "OPENAI",
    envKey: "OPENAI_API_KEY",
    envModel: "OPENAI_MODEL",
    defaultModel: "gpt-5.6-luna",
    endpoint: "https://api.openai.com/v1/responses",
    keyPrefix: "sk-",
  }),
  xai: Object.freeze({
    id: "xai",
    label: "xAI",
    product: "GROK",
    envKey: "XAI_API_KEY",
    envModel: "XAI_MODEL",
    defaultModel: "grok-4.3",
    endpoint: "https://api.x.ai/v1/responses",
    keyPrefix: "xai-",
  }),
  anthropic: Object.freeze({
    id: "anthropic",
    label: "Anthropic",
    product: "CLAUDE",
    envKey: "ANTHROPIC_API_KEY",
    envModel: "ANTHROPIC_MODEL",
    defaultModel: "claude-haiku-4-5-20251001",
    endpoint: "https://api.anthropic.com/v1/messages",
    keyPrefix: "sk-ant-",
  }),
});

function errorWithStatus(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return Object.hasOwn(AI_PROVIDERS, provider) ? provider : "";
}

function hostAiEnabled(environment) {
  return String(environment.ALLOW_HOST_AI || "").trim().toLowerCase() === "true";
}

function validateProviderKey(key, provider) {
  const profile = AI_PROVIDERS[provider];
  if (
    key.length < 20
    || key.length > 512
    || !TOKEN_PATTERN.test(key)
    || !key.startsWith(profile.keyPrefix)
    || (provider === "openai" && (key.startsWith("sk-or-") || key.startsWith("sk-ant-")))
  ) {
    throw errorWithStatus(`${profile.label} authorization was invalid.`, 401);
  }
  return key;
}

export function parseClientAiCredential({ authorization, provider } = {}) {
  const hasAuthorization = authorization !== undefined && authorization !== null && authorization !== "";
  const hasProvider = provider !== undefined && provider !== null && provider !== "";
  if (!hasAuthorization && !hasProvider) return null;
  if (Array.isArray(authorization) || Array.isArray(provider) || !hasAuthorization) {
    throw errorWithStatus("Browser AI authorization was invalid.", 401);
  }
  const match = /^Bearer ([^\s,]+)$/i.exec(String(authorization));
  if (!match) throw errorWithStatus("Browser AI authorization was invalid.", 401);

  // Provider-less Authorization remains an OpenRouter alias for one service-worker
  // generation so already-open tabs do not break during this deployment.
  const normalizedProvider = hasProvider ? normalizeProvider(provider) : DEFAULT_PROVIDER;
  if (!normalizedProvider) throw errorWithStatus("That AI provider is not supported.", 400);
  return {
    provider: normalizedProvider,
    apiKey: validateProviderKey(match[1], normalizedProvider),
  };
}

export function getPublicAiStatus(environment = process.env) {
  const requestedValue = String(environment.AI_PROVIDER || "").trim();
  const requestedProvider = normalizeProvider(requestedValue);
  const configurationValid = !requestedValue || Boolean(requestedProvider);
  const provider = requestedProvider || DEFAULT_PROVIDER;
  const profile = AI_PROVIDERS[provider];
  return {
    aiConfigured: configurationValid
      && hostAiEnabled(environment)
      && Boolean(environment[profile.envKey]),
    provider,
    model: environment[profile.envModel] || profile.defaultModel,
    configurationValid,
    offlineReady: true,
  };
}

export function resolveAiSelection(clientCredential, environment = process.env) {
  if (clientCredential) {
    const provider = clientCredential.provider;
    const profile = AI_PROVIDERS[provider];
    return {
      provider,
      profile,
      apiKey: clientCredential.apiKey,
      model: profile.defaultModel,
      keySource: "browser",
    };
  }

  const requestedValue = String(environment.AI_PROVIDER || "").trim();
  const requestedProvider = normalizeProvider(requestedValue);
  if (requestedValue && !requestedProvider) {
    throw errorWithStatus("AI_PROVIDER is not supported. Host-funded AI is disabled.", 503);
  }
  if (!hostAiEnabled(environment)) {
    throw errorWithStatus("Live AI is not configured. Add a temporary provider key.", 503);
  }
  const provider = requestedProvider || DEFAULT_PROVIDER;
  const profile = AI_PROVIDERS[provider];
  const apiKey = environment[profile.envKey];
  if (!apiKey) {
    throw errorWithStatus(`${profile.label} is not configured. Scripted genius remains available.`, 503);
  }
  return {
    provider,
    profile,
    apiKey,
    model: environment[profile.envModel] || profile.defaultModel,
    keySource: "host",
  };
}

function chatUserContent(userText, image) {
  if (!image) return userText;
  return [
    { type: "text", text: userText },
    { type: "image_url", image_url: { url: image } },
  ];
}

function responsesInput(instructions, userText, image) {
  const content = image
    ? [
        { type: "input_image", image_url: image, detail: "low" },
        { type: "input_text", text: userText },
      ]
    : userText;
  return [
    { role: "system", content: instructions.trim() },
    { role: "user", content },
  ];
}

function withoutNumericBounds(value) {
  if (Array.isArray(value)) return value.map(withoutNumericBounds);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "minimum" && key !== "maximum")
      .map(([key, child]) => [key, withoutNumericBounds(child)]),
  );
}

function anthropicContent(userText, image) {
  const content = [];
  if (image) {
    const match = /^data:image\/(jpeg|jpg|png|webp);base64,([a-z0-9+/=\s]+)$/i.exec(image);
    if (!match) throw errorWithStatus("The image format is not supported by Anthropic.", 415);
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: match[1].toLowerCase() === "jpg" ? "image/jpeg" : `image/${match[1].toLowerCase()}`,
        data: match[2].replace(/\s/g, ""),
      },
    });
  }
  content.push({ type: "text", text: userText });
  return content;
}

function makeRequest(selection, { instructions, userText, image, schema, schemaName, signal }) {
  const common = { method: "POST", signal };
  if (selection.provider === "openrouter") {
    return {
      url: selection.profile.endpoint,
      init: {
        ...common,
        headers: {
          Authorization: `Bearer ${selection.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://no-can-do.vercel.app",
          "X-OpenRouter-Title": "NO CAN DO",
        },
        body: JSON.stringify({
          model: selection.model,
          messages: [
            { role: "system", content: instructions.trim() },
            { role: "user", content: chatUserContent(userText, image) },
          ],
          max_tokens: 300,
          reasoning: { effort: "minimal", exclude: true },
          provider: { require_parameters: true, zdr: true, data_collection: "deny" },
          response_format: {
            type: "json_schema",
            json_schema: { name: schemaName, strict: true, schema },
          },
        }),
      },
    };
  }

  if (selection.provider === "openai" || selection.provider === "xai") {
    if (selection.provider === "xai" && /^data:image\/webp;/i.test(image || "")) {
      throw errorWithStatus("xAI accepts JPEG or PNG evidence for this case.", 415);
    }
    return {
      url: selection.profile.endpoint,
      init: {
        ...common,
        headers: {
          Authorization: `Bearer ${selection.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selection.model,
          store: false,
          reasoning: { effort: "none" },
          max_output_tokens: 300,
          input: responsesInput(instructions, userText, image),
          text: {
            format: { type: "json_schema", name: schemaName, strict: true, schema },
          },
        }),
      },
    };
  }

  return {
    url: selection.profile.endpoint,
    init: {
      ...common,
      headers: {
        "x-api-key": selection.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selection.model,
        max_tokens: 300,
        system: instructions.trim(),
        messages: [{ role: "user", content: anthropicContent(userText, image) }],
        output_config: {
          format: { type: "json_schema", schema: withoutNumericBounds(schema) },
        },
      }),
    },
  };
}

function safeUpstreamCode(payload) {
  return String(payload?.error?.type || payload?.error?.code || "upstream_error")
    .replace(/[^a-z0-9_.-]/gi, "_")
    .slice(0, 64);
}

function normalizeUpstreamError(selection, response, payload) {
  console.error(`[${selection.profile.label} ${response.status}] ${safeUpstreamCode(payload)}`);
  if (response.status === 401) {
    return errorWithStatus(`${selection.profile.label} rejected that API key.`, 401);
  }
  if (response.status === 402) {
    return errorWithStatus(`That ${selection.profile.label} key needs credits.`, 402);
  }
  if ([403, 404, 422].includes(response.status)) {
    return errorWithStatus(`That ${selection.profile.label} key cannot use this model.`, 403);
  }
  if ([408, 504].includes(response.status)) {
    return errorWithStatus(`${selection.profile.label} timed out.`, 504);
  }
  if ([429, 529].includes(response.status)) {
    return errorWithStatus(`${selection.profile.label} is emotionally overloaded. Try again shortly.`, 503);
  }
  return errorWithStatus("Live AI could not hear this case. Scripted precedent is still available.", 502);
}

export async function requestProviderStructuredOutput(options) {
  const selection = resolveAiSelection(options.clientCredential, options.environment);
  const request = makeRequest(selection, options);
  let response;
  try {
    response = await fetch(request.url, request.init);
  } catch (error) {
    if (options.signal?.aborted) throw errorWithStatus("Live judgment timed out.", 504);
    throw errorWithStatus(`${selection.profile.label} could not be reached.`, 502);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw normalizeUpstreamError(selection, response, payload);

  if (
    (selection.provider === "openai" || selection.provider === "xai")
    && payload.status
    && payload.status !== "completed"
  ) {
    throw errorWithStatus(`${selection.profile.label} did not complete the judgment.`, 502);
  }
  if (
    selection.provider === "anthropic"
    && ["max_tokens", "refusal"].includes(payload.stop_reason)
  ) {
    throw errorWithStatus("Anthropic did not complete the judgment.", 502);
  }
  return { payload, provider: selection.provider, model: selection.model };
}
