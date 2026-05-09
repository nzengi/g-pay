import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { resolve } from "node:path";
import { buildDemoRouter } from "./routes/demo.js";
import { buildInternalRouter, buildRouter } from "./routes.js";
import { createStore, type Institution, type Store } from "./store/index.js";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function buildApp(
  store: Store,
  internalSecret = "dev-internal-secret-rotate",
) {
  const app = new Hono();
  app.get("/", (c) =>
    c.json({ name: "g-pay api-gateway", version: "0.1.0" }),
  );
  app.get("/healthz", (c) => c.json({ ok: true }));
  app.route("/", buildRouter(store));
  app.route("/", buildInternalRouter(store, internalSecret));
  app.route("/", buildDemoRouter(store));
  return app;
}

const DEMO_INSTITUTION: Institution = {
  id: "demo_bank",
  apiKey: "g-p_demo_h6kj9d8s7g6f5d4",
  spendPub: hexToBytes(
    "616e237719716e25ead63d831f9117f79b5aa05af8be30ff0eddb3dc43e8bdcf",
  ),
  viewPub: hexToBytes(
    "3e97bbe3dad77cdbab3b9d7a5af963868b2ee668470874b566dad4a32076c98b",
  ),
  releaseAuthority: new Uint8Array(32),
  webhookUrl: null,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const internalSecret =
    process.env.GPAY_INTERNAL_SECRET ?? "dev-internal-secret-rotate";

  const migrationsFile =
    process.env.GPAY_MIGRATIONS_FILE ??
    (process.env.DATABASE_URL
      ? resolve(process.cwd(), "deploy/migrations/001_init.sql")
      : null);

  const { store, shutdown } = await createStore({
    databaseUrl: process.env.DATABASE_URL,
    migrationsFile,
    bootstrapInstitutions: process.env.DATABASE_URL ? [] : [DEMO_INSTITUTION],
  });

  const app = buildApp(store, internalSecret);
  const port = Number(process.env.PORT ?? 3000);
  const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(
      `gpay-api-gateway listening on http://localhost:${info.port} ` +
        `(store: ${process.env.DATABASE_URL ? "postgres" : "memory"})`,
    );
  });

  const stop = async () => {
    server.close();
    await shutdown();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
