import { createHmac, timingSafeEqual } from "node:crypto";
import {
  ConfigurationError,
  getProfile,
  loadStructureConfig,
  normalizePostType,
  resolveConfiguration,
  setRange,
  validateConfiguration
} from "./config.js";
import { composeTemplate } from "./templates.js";

const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_REQUEST_BODY_BYTES = 1_000_000;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const QUESTIONS = [
  {
    id: "postType",
    prompt: "What kind of post do you need?",
    type: "choice",
    choices: ["blog", "social_media"]
  },
  {
    id: "body.words",
    prompt: "How long should the post body be?",
    type: "range",
    path: ["body", "words"]
  },
  {
    id: "title.words",
    prompt: "How long should the main title be?",
    type: "range",
    path: ["title", "words"]
  },
  {
    id: "subtitles.count",
    prompt: "How many subtitles or content beats should the post have?",
    type: "range",
    path: ["subtitles", "count"]
  },
  {
    id: "subtitles.words",
    prompt: "How long should each subtitle be?",
    type: "range",
    path: ["subtitles", "words"]
  },
  {
    id: "body.sections",
    prompt: "How many body sections should the post have?",
    type: "range",
    path: ["body", "sections"]
  },
  {
    id: "tags.count",
    prompt: "How many tags should the post have?",
    type: "range",
    path: ["tags", "count"],
    requiredRange: { min: 10, max: 10 }
  }
];

export class SessionError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = "SessionError";
    this.status = status;
  }
}

export function createApiHandler({
  sessionSecret = process.env.SESSION_SECRET,
  now = () => Date.now(),
  sessionTtlMs = SESSION_TTL_MS
} = {}) {
  const sessionCodec = sessionSecret ? createSessionCodec(sessionSecret) : null;

  return async function handleRequest(request) {
    try {
      const url = new URL(request.url);
      const path = normalizeFunctionPath(url.pathname);

      if (request.method === "OPTIONS") return emptyResponse(204);
      if (request.method === "GET" && path === "/") {
        return request.headers.get("accept")?.includes("text/html")
          ? htmlResponse(200, renderDiscoveryPage())
          : jsonResponse(200, apiDiscovery());
      }
      if (request.method === "GET" && path === "/health") {
        return jsonResponse(200, { status: "ok" });
      }
      if (request.method === "GET" && path === "/v1/post-types") {
        const config = loadStructureConfig();
        return jsonResponse(200, {
          postTypes: Object.keys(config.profiles),
          profiles: config.profiles
        });
      }
      if (request.method === "POST" && path === "/v1/templates") {
        const body = await readJson(request);
        const postType = normalizePostType(body.postType);
        const configuration = resolveConfiguration(postType, body.configuration ?? {});
        return jsonResponse(200, templateResponse(postType, configuration));
      }
      if (request.method === "POST" && path === "/v1/sessions") {
        if (!sessionCodec) {
          throw new SessionError("Guided sessions require SESSION_SECRET to be configured.", 503);
        }
        return jsonResponse(201, sessionQuestion(createSession(now, sessionTtlMs), sessionCodec));
      }
      if (request.method === "POST" && path === "/v1/sessions/answers") {
        if (!sessionCodec) {
          throw new SessionError("Guided sessions require SESSION_SECRET to be configured.", 503);
        }
        const body = await readJson(request);
        const session = sessionCodec.decode(body.sessionToken, now());
        const result = answerSession(session, body.value);

        if (result.questionIndex === QUESTIONS.length) {
          return jsonResponse(200, {
            complete: true,
            ...templateResponse(result.postType, result.configuration)
          });
        }

        return jsonResponse(200, sessionQuestion(result, sessionCodec));
      }

      return jsonResponse(404, { error: "Route not found." });
    } catch (error) {
      return jsonResponse(errorStatus(error), { error: error.message || "Unexpected server error." });
    }
  };
}

function createSession(now, sessionTtlMs) {
  return {
    version: 1,
    questionIndex: 0,
    postType: null,
    configuration: null,
    expiresAt: now() + sessionTtlMs
  };
}

function answerSession(session, value) {
  const question = QUESTIONS[session.questionIndex];
  if (!question) throw new SessionError("This guided session is already complete.", 409);

  if (question.id === "postType") {
    session.postType = normalizePostType(value);
    session.configuration = getProfile(session.postType);
  } else if (value !== "default") {
    setRange(session.configuration, question.path, value);
  }

  session.questionIndex += 1;
  return session;
}

function sessionQuestion(session, sessionCodec) {
  const question = QUESTIONS[session.questionIndex];
  const response = {
    sessionToken: sessionCodec.encode(session),
    complete: false,
    question: { id: question.id, prompt: question.prompt, type: question.type }
  };

  if (question.choices) response.question.choices = question.choices;
  if (question.path && session.configuration) {
    response.question.default = question.path.reduce((current, key) => current[key], session.configuration);
    response.question.accepts = "{ min: integer, max: integer } or 'default'";
  }
  if (question.requiredRange) response.question.requiredRange = question.requiredRange;
  return response;
}

function createSessionCodec(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new SessionError("SESSION_SECRET must be a string with at least 32 characters.", 503);
  }

  return {
    encode(session) {
      const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
      return `${payload}.${sign(payload, secret)}`;
    },
    decode(token, now) {
      if (typeof token !== "string") throw new SessionError("sessionToken is required.");

      const [payload, signature, ...extraParts] = token.split(".");
      if (!payload || !signature || extraParts.length > 0 || !matchesSignature(payload, signature, secret)) {
        throw new SessionError("sessionToken is invalid.");
      }

      let session;
      try {
        session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      } catch {
        throw new SessionError("sessionToken is invalid.");
      }

      if (session.version !== 1 || !Number.isInteger(session.questionIndex) || session.questionIndex < 0) {
        throw new SessionError("sessionToken is invalid.");
      }
      if (!Number.isFinite(session.expiresAt) || now >= session.expiresAt) {
        throw new SessionError("sessionToken has expired.", 410);
      }
      if (session.questionIndex > 0) {
        session.postType = normalizePostType(session.postType);
        validateConfiguration(session.configuration);
      }

      return session;
    }
  };
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function matchesSignature(payload, signature, secret) {
  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function normalizeFunctionPath(path) {
  if (path === "/api") return "/";
  return path.startsWith("/api/") ? path.slice(4) : path;
}

function templateResponse(postType, configuration) {
  return {
    postType,
    configuration,
    templates: composeTemplate(postType, configuration)
  };
}

function apiDiscovery() {
  return {
    name: "Reusable Marketing Post Templates API",
    version: "v1",
    documentation: "Repository docs/API.md",
    endpoints: [
      { method: "GET", path: "/health", description: "Service health check" },
      { method: "GET", path: "/v1/post-types", description: "Available post types and profiles" },
      { method: "POST", path: "/v1/templates", description: "Compose a template directly" },
      { method: "POST", path: "/v1/sessions", description: "Start guided configuration" },
      { method: "POST", path: "/v1/sessions/answers", description: "Answer the next guided question" }
    ]
  };
}

async function readJson(request) {
  const body = await request.text();
  if (body.length > MAX_REQUEST_BODY_BYTES) {
    throw new ConfigurationError("Request body must be smaller than 1 MB.");
  }
  return body ? JSON.parse(body) : {};
}

function errorStatus(error) {
  if (error instanceof SessionError) return error.status;
  if (error instanceof ConfigurationError) return 422;
  if (error instanceof SyntaxError) return 400;
  return 500;
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" }
  });
}

function htmlResponse(status, body) {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "text/html; charset=utf-8" }
  });
}

function emptyResponse(status) {
  return new Response(null, { status, headers: CORS_HEADERS });
}

function renderDiscoveryPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reusable Marketing Post Templates API</title>
    <style>
      body { max-width: 760px; margin: 48px auto; padding: 0 24px; color: #172033; background: #f8fafc; font: 16px/1.5 system-ui, sans-serif; }
      main { padding: 32px; background: #fff; border: 1px solid #dbe3ee; border-radius: 16px; box-shadow: 0 8px 32px rgb(15 23 42 / 8%); }
      h1 { margin-top: 0; }
      code { padding: 2px 5px; background: #e8eef7; border-radius: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { padding: 12px 8px; border-bottom: 1px solid #dbe3ee; text-align: left; }
      th { color: #475569; font-size: 13px; text-transform: uppercase; }
      .method { color: #075985; font-weight: 700; }
      .hint { color: #475569; }
    </style>
  </head>
  <body>
    <main>
      <h1>Reusable Marketing Post Templates API</h1>
      <p>Use this API to compose a blog or social-media post template directly, or answer configuration questions one step at a time.</p>
      <p class="hint">Browser page detected. Programmatic clients can request <code>application/json</code> from this same route.</p>
      <table>
        <thead><tr><th>Method</th><th>Endpoint</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td class="method">GET</td><td><code>/health</code></td><td>Check service status</td></tr>
          <tr><td class="method">GET</td><td><code>/v1/post-types</code></td><td>View profiles</td></tr>
          <tr><td class="method">POST</td><td><code>/v1/templates</code></td><td>Compose directly</td></tr>
          <tr><td class="method">POST</td><td><code>/v1/sessions</code></td><td>Start guided configuration</td></tr>
        </tbody>
      </table>
      <p class="hint">See <code>docs/API.md</code> in the repository for request examples.</p>
    </main>
  </body>
</html>`;
}
