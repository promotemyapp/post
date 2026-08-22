import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";
import vercelFunction from "../api/index.js";
import { createApiHandler, createApiServer, startApiServer } from "../src/server.js";

const SESSION_SECRET = "test-session-secret-with-at-least-32-characters";

async function withApi(run, options = {}) {
  const server = createApiServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("root route returns a browser-friendly API discovery page", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(baseUrl, { headers: { Accept: "text/html" } });
    const page = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(page, /Reusable Marketing Post Templates API/);
    assert.match(page, /\/v1\/templates/);
  });
});

test("root route returns JSON discovery for programmatic clients", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(baseUrl, { headers: { Accept: "application/json" } });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.version, "v1");
    assert.equal(result.endpoints.length, 5);
  });
});

test("Vercel Function route prefix uses the same API handler", async () => {
  const handler = createApiHandler();
  const response = await handler(new Request("https://example.vercel.app/api/v1/post-types"));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(result.postTypes, ["blog", "social_media"]);
});

test("Vercel Function entrypoint serves the health route", async () => {
  const response = await vercelFunction.fetch(new Request("https://example.vercel.app/health"));
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("direct template request composes a blog template with configuration overrides", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postType: "blog",
        configuration: { body: { words: { min: 2500, max: 3500 } } }
      })
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(result.configuration.body.words, { min: 2500, max: 3500 });
    assert.match(result.templates.combined, /type: "Blog Post"/);
    assert.match(result.templates.combined, /resolved_structure:/);
  });
});

test("startup falls back to the next port when the default is occupied", async () => {
  const occupiedServer = createHttpServer();
  await new Promise((resolve) => occupiedServer.listen(0, "127.0.0.1", resolve));
  const occupiedPort = occupiedServer.address().port;
  const apiServer = createApiServer();

  try {
    const active = await startApiServer({
      server: apiServer,
      port: occupiedPort,
      host: "127.0.0.1",
      maxPort: occupiedPort + 1
    });
    assert.equal(active.port, occupiedPort + 1);
  } finally {
    await new Promise((resolve) => apiServer.close(resolve));
    await new Promise((resolve) => occupiedServer.close(resolve));
  }
});

test("direct template request rejects a tag count other than ten", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postType: "social_media",
        configuration: { tags: { count: { min: 8, max: 8 } } }
      })
    });

    assert.equal(response.status, 422);
    assert.match((await response.json()).error, /exactly 10/);
  });
});

test("guided session asks each configuration question and returns a social template", async () => {
  await withApi(async (baseUrl) => {
    let response = await fetch(`${baseUrl}/v1/sessions`, { method: "POST" });
    let result = await response.json();
    assert.equal(result.question.id, "postType");

    const answers = ["social_media", "default", "default", "default", "default", "default", "default"];
    for (const value of answers) {
      response = await fetch(`${baseUrl}/v1/sessions/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: result.sessionToken, value })
      });
      result = await response.json();
    }

    assert.equal(response.status, 200);
    assert.equal(result.complete, true);
    assert.equal(result.postType, "social_media");
    assert.match(result.templates.combined, /type: "Social Media Post"/);
  }, { sessionSecret: SESSION_SECRET });
});

test("guided session tokens work across separate handler instances", async () => {
  const firstHandler = createApiHandler({ sessionSecret: SESSION_SECRET });
  const startResponse = await firstHandler(new Request("https://example.vercel.app/v1/sessions", { method: "POST" }));
  const start = await startResponse.json();
  const secondHandler = createApiHandler({ sessionSecret: SESSION_SECRET });
  const answerResponse = await secondHandler(new Request("https://example.vercel.app/v1/sessions/answers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken: start.sessionToken, value: "blog" })
  }));
  const answer = await answerResponse.json();

  assert.equal(answerResponse.status, 200);
  assert.equal(answer.question.id, "body.words");
  assert.equal(typeof answer.sessionToken, "string");
});

test("guided sessions require a configured signing secret", async () => {
  const handler = createApiHandler({ sessionSecret: undefined });
  const response = await handler(new Request("https://example.vercel.app/v1/sessions", { method: "POST" }));

  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /SESSION_SECRET/);
});
