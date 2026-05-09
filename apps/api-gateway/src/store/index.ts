import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { MemoryStore } from "./memory.js";
import { PostgresStore } from "./postgres.js";
import type { Institution, Store } from "./types.js";

export { MemoryStore } from "./memory.js";
export { PostgresStore } from "./postgres.js";
export type {
  DepositCreate,
  DepositRecord,
  DepositState,
  Institution,
  Store,
} from "./types.js";

export interface StoreFactoryOptions {
  databaseUrl?: string;
  migrationsFile?: string | null;
  bootstrapInstitutions?: Institution[];
}

export async function createStore(options: StoreFactoryOptions = {}): Promise<{
  store: Store;
  shutdown: () => Promise<void>;
}> {
  const url = options.databaseUrl ?? process.env.DATABASE_URL;

  if (!url) {
    const store = new MemoryStore();
    if (options.bootstrapInstitutions) {
      for (const inst of options.bootstrapInstitutions) {
        await store.putInstitution(inst);
      }
    }
    return { store, shutdown: async () => {} };
  }

  const pool = new Pool({ connectionString: url, max: 8 });
  if (options.migrationsFile) {
    const sql = await readFile(options.migrationsFile, "utf8");
    await pool.query(sql);
  }
  const store = new PostgresStore(pool);
  if (options.bootstrapInstitutions) {
    for (const inst of options.bootstrapInstitutions) {
      await store.putInstitution(inst);
    }
  }
  return {
    store,
    shutdown: async () => {
      await pool.end();
    },
  };
}
