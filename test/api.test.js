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
    assert.equal(result.endpoints.length, 6);
    assert.equal(result.endpoints[2].path, "/v1/templates/recommended");
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
  assert.equal(typeof vercelFunction, "function");
  const directResponse = await vercelFunction(new Request("https://example.vercel.app/health"));
  assert.deepEqual(await directResponse.json(), { status: "ok" });

  const fetchResponse = await vercelFunction.fetch(new Request("https://example.vercel.app/health"));
  assert.deepEqual(await fetchResponse.json(), { status: "ok" });
});

test("specific direct mode composes a blog template with configuration overrides", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/templates/specific`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postType: "blog",
        configuration: { body: { words: { min: 2500, max: 3500 } } }
      })
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.mode, "specific");
    assert.equal(result.delivery, "direct");
    assert.deepEqual(result.configuration.body.words, { min: 2500, max: 3500 });
    assert.equal(result.guidance.source, "README.md#agent-operating-view");
    assert.equal(result.packageVersion, "1.0");
    assert.equal(result.template.id, "blog-post-template");
    assert.match(result.template.markdown, /type: "Blog Post Template"/);
    assert.match(result.template.markdown, /resolved_structure:/);
  });
});

test("recommendation mode returns the researched fixed blog template package", async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/templates/recommended`, { method: "POST" });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.mode, "recommended");
    assert.equal(result.delivery, "direct");
    assert.equal(result.postType, "blog");
    assert.equal(result.fixedRecommendations.recommendations.body.words, 1800);
    assert.deepEqual(result.configuration.title.words, { min: 8, max: 8 });
    assert.match(result.guidance.markdown, /Required inputs/);
    assert.equal(result.keywordResearch.source, "README.md#keyword-research-workflow");
    assert.match(result.keywordResearch.markdown, /primary_query/);
    assert.match(result.keywordResearch.markdown, /Search Console/);
    assert.equal(result.template.id, "blog-post-template");
    assert.match(result.template.markdown, /fixed_recommendations_config/);
    assert.match(result.template.markdown, /required_inputs:/);
    assert.match(result.template.markdown, /keyword_research:/);
    assert.match(result.template.markdown, /PRIMARY_QUERY/);
    assert.match(result.template.markdown, /{{DIRECT_ANSWER_OR_KEY_TAKEAWAY}}/);
    assert.equal((result.template.markdown.match(/^## \{\{SECTION_TITLE_/gm) ?? []).length, 10);
    assert.equal((result.template.markdown.match(/^## /gm) ?? []).length, 10);
    assert.equal((result.template.markdown.match(/SOURCE_CITATION_/g) ?? []).length, 5);
    assert.equal((result.template.markdown.match(/EXPERT_QUOTE_01/g) ?? []).length, 1);
    assert.equal((result.template.markdown.match(/FAQ_QUESTION_/g) ?? []).length, 3);
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
    let response = await fetch(`${baseUrl}/v1/templates/specific/guided`, { method: "POST" });
    let result = await response.json();
    assert.equal(result.question.id, "postType");
    assert.equal(result.mode, "specific");
    assert.equal(result.delivery, "guided");

    const answers = ["social_media", "default", "default", "default", "default", "default", "default"];
    for (const value of answers) {
      response = await fetch(`${baseUrl}/v1/templates/specific/guided/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: result.sessionToken, value })
      });
      result = await response.json();
    }

    assert.equal(response.status, 200);
    assert.equal(result.complete, true);
    assert.equal(result.mode, "specific");
    assert.equal(result.delivery, "guided");
    assert.equal(result.postType, "social_media");
    assert.equal(result.template.id, "social-media-post-template");
    assert.match(result.template.markdown, /type: "Social Media Post"/);
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
