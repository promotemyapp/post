import { createApiHandler } from "../src/handler.js";

const handler = createApiHandler();

async function vercelFunction(request) {
  return handler(request);
}

vercelFunction.fetch = vercelFunction;

export default vercelFunction;
