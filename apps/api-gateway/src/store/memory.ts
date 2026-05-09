import type {
  DepositCreate,
  DepositRecord,
  DepositState,
  Institution,
  Store,
} from "./types.js";

export class MemoryStore implements Store {
  private institutions = new Map<string, Institution>();
  private deposits = new Map<string, DepositRecord>();
  private nextDepositSeq = 1;

  async putInstitution(inst: Institution): Promise<void> {
    this.institutions.set(inst.id, inst);
  }

  async findByApiKey(apiKey: string): Promise<Institution | undefined> {
    for (const inst of this.institutions.values()) {
      if (inst.apiKey === apiKey) return inst;
    }
    return undefined;
  }

  async getInstitution(id: string): Promise<Institution | undefined> {
    return this.institutions.get(id);
  }

  async createDeposit(record: DepositCreate): Promise<DepositRecord> {
    const id = `dep_${this.nextDepositSeq++}`;
    const full: DepositRecord = {
      ...record,
      id,
      createdAt: Date.now(),
      state: "pending",
      onChainAddress: null,
      onChainAmount: null,
      onChainState: null,
      onChainObservedAt: null,
    };
    this.deposits.set(id, full);
    return full;
  }

  async getDeposit(id: string): Promise<DepositRecord | undefined> {
    return this.deposits.get(id);
  }

  async setDepositState(
    id: string,
    state: DepositState,
  ): Promise<DepositRecord | undefined> {
    const d = this.deposits.get(id);
    if (!d) return undefined;
    d.state = state;
    return d;
  }

  async applyOnChainMatch(
    stealthPubkeyHex: string,
    onChainAddress: string,
    amount: bigint,
    state: string,
  ): Promise<DepositRecord | undefined> {
    for (const d of this.deposits.values()) {
      if (bytesToHex(d.stealthPubkey) === stealthPubkeyHex) {
        d.onChainAddress = onChainAddress;
        d.onChainAmount = amount;
        d.onChainState = state;
        d.onChainObservedAt = Date.now();
        if (
          state === "approved" ||
          state === "rejected" ||
          state === "released" ||
          state === "refunded" ||
          state === "expired"
        ) {
          d.state = state as DepositState;
        }
        return d;
      }
    }
    return undefined;
  }

  async listInstitutionDeposits(
    institutionId: string,
    limit = 200,
  ): Promise<DepositRecord[]> {
    return [...this.deposits.values()]
      .filter((d) => d.institutionId === institutionId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }
}

function bytesToHex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
