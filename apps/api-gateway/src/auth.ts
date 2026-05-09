import type { Context, Next } from "hono";
import type { Institution, Store } from "./store/index.js";

declare module "hono" {
  interface ContextVariableMap {
    institution: Institution;
  }
}

export function apiKeyAuth(store: Store) {
  return async (c: Context, next: Next) => {
    const key = c.req.header("x-api-key");
    if (!key) {
      return c.json({ error: "missing X-API-Key header" }, 401);
    }
    const inst = await store.findByApiKey(key);
    if (!inst) {
      return c.json({ error: "invalid api key" }, 401);
    }
    c.set("institution", inst);
    await next();
  };
}
