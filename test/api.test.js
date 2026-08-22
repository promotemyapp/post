import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";
import { createApiServer, startApiServer } from "../src/server.js";

async function withApi(run) {
  const server = createApiServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

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
      response = await fetch(`${baseUrl}/v1/sessions/${result.sessionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value })
      });
      result = await response.json();
    }

    assert.equal(response.status, 200);
    assert.equal(result.complete, true);
    assert.equal(result.postType, "social_media");
    assert.match(result.templates.combined, /type: "Social Media Post"/);
  });
});
