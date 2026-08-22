import { createServer as createHttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  ConfigurationError,
  getProfile,
  loadStructureConfig,
  normalizePostType,
  resolveConfiguration,
  setRange
} from "./config.js";
import { composeTemplate } from "./templates.js";

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT_ATTEMPTS = 11;

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

export function createApiServer({ sessions = new Map() } = {}) {
  return createHttpServer(async (request, response) => {
    try {
      applyCors(response);
      if (request.method === "OPTIONS") return send(response, 204);

      const url = new URL(request.url, `http://${request.headers.host}`);
      if (request.method === "GET" && url.pathname === "/health") {
        return send(response, 200, { status: "ok" });
      }

      if (request.method === "GET" && url.pathname === "/v1/post-types") {
        const config = loadStructureConfig();
        return send(response, 200, {
          postTypes: Object.keys(config.profiles),
          profiles: config.profiles
        });
      }

      if (request.method === "POST" && url.pathname === "/v1/templates") {
        const body = await readJson(request);
        const postType = normalizePostType(body.postType);
        const configuration = resolveConfiguration(postType, body.configuration ?? {});
        return send(response, 200, templateResponse(postType, configuration));
      }

      if (request.method === "POST" && url.pathname === "/v1/sessions") {
        const id = randomUUID();
        const session = { id, questionIndex: 0, postType: null, configuration: null };
        sessions.set(id, session);
        return send(response, 201, sessionQuestion(session));
      }

      const answerMatch = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/answers$/);
      if (request.method === "POST" && answerMatch) {
        const session = sessions.get(answerMatch[1]);
        if (!session) return send(response, 404, { error: "Unknown guided session." });

        const body = await readJson(request);
        return send(response, 200, answerSession(session, body.value));
      }

      return send(response, 404, { error: "Route not found." });
    } catch (error) {
      const status = error instanceof ConfigurationError ? 422 : error instanceof SyntaxError ? 400 : 500;
      return send(response, status, { error: error.message || "Unexpected server error." });
    }
  });
}

export async function startApiServer({
  server = createApiServer(),
  port = DEFAULT_PORT,
  host = DEFAULT_HOST,
  allowFallback = true,
  maxPort = port + DEFAULT_PORT_ATTEMPTS - 1
} = {}) {
  const lastPort = allowFallback ? maxPort : port;

  for (let candidatePort = port; candidatePort <= lastPort; candidatePort += 1) {
    try {
      await listen(server, candidatePort, host);
      return { server, host, port: candidatePort };
    } catch (error) {
      if (error.code !== "EADDRINUSE" || candidatePort === lastPort) throw error;
    }
  }
}

function answerSession(session, value) {
  const question = QUESTIONS[session.questionIndex];
  if (!question) throw new ConfigurationError("This guided session is already complete.");

  if (question.id === "postType") {
    session.postType = normalizePostType(value);
    session.configuration = getProfile(session.postType);
  } else if (value !== "default") {
    setRange(session.configuration, question.path, value);
  }

  session.questionIndex += 1;
  if (session.questionIndex === QUESTIONS.length) {
    return {
      sessionId: session.id,
      complete: true,
      ...templateResponse(session.postType, session.configuration)
    };
  }

  return sessionQuestion(session);
}

function sessionQuestion(session) {
  const question = QUESTIONS[session.questionIndex];
  const response = {
    sessionId: session.id,
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

function templateResponse(postType, configuration) {
  return {
    postType,
    configuration,
    templates: composeTemplate(postType, configuration)
  };
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new ConfigurationError("Request body must be smaller than 1 MB.");
  }
  return body ? JSON.parse(body) : {};
}

function applyCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function send(response, status, body) {
  response.statusCode = status;
  if (body === undefined) return response.end();
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("error", onError);
      reject(error);
    };

    server.once("error", onError);
    server.listen({ port, host }, () => {
      server.off("error", onError);
      resolve();
    });
  });
}

function readPort(value, label) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError(`${label} must be an integer from 1 through 65535.`);
  }
  return port;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const hasExplicitPort = process.env.PORT !== undefined;
  const port = hasExplicitPort ? readPort(process.env.PORT, "PORT") : DEFAULT_PORT;
  const host = process.env.HOST || DEFAULT_HOST;

  startApiServer({ port, host, allowFallback: !hasExplicitPort })
    .then(({ port: activePort }) => {
      console.log(`Post template API listening on http://${host}:${activePort}`);
    })
    .catch((error) => {
      console.error(`Unable to start Post template API: ${error.message}`);
      process.exitCode = 1;
    });
}
