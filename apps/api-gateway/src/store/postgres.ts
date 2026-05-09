import { Pool, type PoolClient } from "pg";
import type {
  DepositCreate,
  DepositRecord,
  DepositState,
  Institution,
  Store,
} from "./types.js";

interface DepositRow {
  id: string;
  institution_id: string;
  customer_id: string;
  amount_hint: string;
  mint: string;
  stealth_pubkey: Buffer;
  ephemeral_r: Buffer;
  view_tag: number;
  refund_addr: Buffer;
  state: string;
  created_at: Date;
  expires_at: Date;
  on_chain_address: string | null;
  on_chain_amount: string | null;
  on_chain_state: string | null;
  on_chain_observed_at: Date | null;
}

interface InstitutionRow {
  id: string;
  api_key: string;
  spend_pub: Buffer;
  view_pub: Buffer;
  release_authority: Buffer;
  webhook_url: string | null;
}

function rowToInstitution(r: InstitutionRow): Institution {
  return {
    id: r.id,
    apiKey: r.api_key,
    spendPub: new Uint8Array(r.spend_pub),
    viewPub: new Uint8Array(r.view_pub),
    releaseAuthority: new Uint8Array(r.release_authority),
    webhookUrl: r.webhook_url,
  };
}

function rowToDeposit(r: DepositRow): DepositRecord {
  return {
    id: r.id,
    institutionId: r.institution_id,
    customerId: r.customer_id,
    amountHint: BigInt(r.amount_hint),
    mint: r.mint,
    stealthPubkey: new Uint8Array(r.stealth_pubkey),
    ephemeralR: new Uint8Array(r.ephemeral_r),
    viewTag: r.view_tag,
    refundAddr: new Uint8Array(r.refund_addr),
    state: r.state as DepositState,
    createdAt: r.created_at.getTime(),
    expiresAt: r.expires_at.getTime(),
    onChainAddress: r.on_chain_address,
    onChainAmount: r.on_chain_amount === null ? null : BigInt(r.on_chain_amount),
    onChainState: r.on_chain_state,
    onChainObservedAt: r.on_chain_observed_at?.getTime() ?? null,
  };
}

function toBuffer(u: Uint8Array): Buffer {
  return Buffer.from(u.buffer, u.byteOffset, u.byteLength);
}

function bytesToHex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export class PostgresStore implements Store {
  constructor(private readonly pool: Pool) {}

  async withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      return await fn(c);
    } finally {
      c.release();
    }
  }

  async putInstitution(inst: Institution): Promise<void> {
    await this.pool.query(
      `INSERT INTO institutions (id, api_key, spend_pub, view_pub, release_authority, webhook_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         api_key = EXCLUDED.api_key,
         spend_pub = EXCLUDED.spend_pub,
         view_pub = EXCLUDED.view_pub,
         release_authority = EXCLUDED.release_authority,
         webhook_url = EXCLUDED.webhook_url`,
      [
        inst.id,
        inst.apiKey,
        toBuffer(inst.spendPub),
        toBuffer(inst.viewPub),
        toBuffer(inst.releaseAuthority),
        inst.webhookUrl,
      ],
    );
  }

  async findByApiKey(apiKey: string): Promise<Institution | undefined> {
    const r = await this.pool.query<InstitutionRow>(
      `SELECT * FROM institutions WHERE api_key = $1 LIMIT 1`,
      [apiKey],
    );
    return r.rows[0] ? rowToInstitution(r.rows[0]) : undefined;
  }

  async getInstitution(id: string): Promise<Institution | undefined> {
    const r = await this.pool.query<InstitutionRow>(
      `SELECT * FROM institutions WHERE id = $1 LIMIT 1`,
      [id],
    );
    return r.rows[0] ? rowToInstitution(r.rows[0]) : undefined;
  }

  async createDeposit(record: DepositCreate): Promise<DepositRecord> {
    const id = `dep_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    const expiresAt = new Date(record.expiresAt);
    const r = await this.pool.query<DepositRow>(
      `INSERT INTO deposits
        (id, institution_id, customer_id, amount_hint, mint, stealth_pubkey, ephemeral_r, view_tag, refund_addr, state, expires_at)
       VALUES ($1, $2, $3, $4::numeric, $5, $6, $7, $8, $9, 'pending', $10)
       RETURNING *`,
      [
        id,
        record.institutionId,
        record.customerId,
        record.amountHint.toString(),
        record.mint,
        toBuffer(record.stealthPubkey),
        toBuffer(record.ephemeralR),
        record.viewTag,
        toBuffer(record.refundAddr),
        expiresAt,
      ],
    );
    return rowToDeposit(r.rows[0]!);
  }

  async getDeposit(id: string): Promise<DepositRecord | undefined> {
    const r = await this.pool.query<DepositRow>(
      `SELECT * FROM deposits WHERE id = $1 LIMIT 1`,
      [id],
    );
    return r.rows[0] ? rowToDeposit(r.rows[0]) : undefined;
  }

  async setDepositState(
    id: string,
    state: DepositState,
  ): Promise<DepositRecord | undefined> {
    const r = await this.pool.query<DepositRow>(
      `UPDATE deposits SET state = $2 WHERE id = $1 RETURNING *`,
      [id, state],
    );
    return r.rows[0] ? rowToDeposit(r.rows[0]) : undefined;
  }

  async applyOnChainMatch(
    stealthPubkeyHex: string,
    onChainAddress: string,
    amount: bigint,
    state: string,
  ): Promise<DepositRecord | undefined> {
    const stealthBuf = Buffer.from(stealthPubkeyHex, "hex");
    const terminal =
      state === "approved" ||
      state === "rejected" ||
      state === "released" ||
      state === "refunded" ||
      state === "expired";
    const r = await this.pool.query<DepositRow>(
      `UPDATE deposits SET
         on_chain_address = $2,
         on_chain_amount = $3::numeric,
         on_chain_state = $4,
         on_chain_observed_at = now(),
         state = CASE WHEN $5::bool THEN $4 ELSE state END
       WHERE stealth_pubkey = $1
       RETURNING *`,
      [stealthBuf, onChainAddress, amount.toString(), state, terminal],
    );
    return r.rows[0] ? rowToDeposit(r.rows[0]) : undefined;
  }

  async listInstitutionDeposits(
    institutionId: string,
    limit = 200,
  ): Promise<DepositRecord[]> {
    const r = await this.pool.query<DepositRow>(
      `SELECT * FROM deposits WHERE institution_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [institutionId, limit],
    );
    return r.rows.map(rowToDeposit);
  }
}

// Avoid unused warning when bytesToHex is removed by tree-shaking; kept for symmetry with memory store.
export const _unusedHelpers = { bytesToHex };
