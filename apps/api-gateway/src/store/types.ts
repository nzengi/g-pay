export interface Institution {
  id: string;
  apiKey: string;
  spendPub: Uint8Array;
  viewPub: Uint8Array;
  releaseAuthority: Uint8Array;
  webhookUrl: string | null;
}

export type DepositState =
  | "pending"
  | "approved"
  | "rejected"
  | "released"
  | "refunded"
  | "expired";

export interface DepositRecord {
  id: string;
  institutionId: string;
  customerId: string;
  amountHint: bigint;
  mint: string;
  stealthPubkey: Uint8Array;
  ephemeralR: Uint8Array;
  viewTag: number;
  refundAddr: Uint8Array;
  createdAt: number;
  expiresAt: number;
  state: DepositState;

  onChainAddress: string | null;
  onChainAmount: bigint | null;
  onChainState: string | null;
  onChainObservedAt: number | null;
}

export type DepositCreate = Omit<
  DepositRecord,
  | "id"
  | "createdAt"
  | "state"
  | "onChainAddress"
  | "onChainAmount"
  | "onChainState"
  | "onChainObservedAt"
>;

/** All store implementations (memory, postgres) speak this. */
export interface Store {
  putInstitution(inst: Institution): Promise<void>;
  findByApiKey(apiKey: string): Promise<Institution | undefined>;
  getInstitution(id: string): Promise<Institution | undefined>;

  createDeposit(record: DepositCreate): Promise<DepositRecord>;
  getDeposit(id: string): Promise<DepositRecord | undefined>;
  setDepositState(id: string, state: DepositState): Promise<DepositRecord | undefined>;
  applyOnChainMatch(
    stealthPubkeyHex: string,
    onChainAddress: string,
    amount: bigint,
    state: string,
  ): Promise<DepositRecord | undefined>;
  listInstitutionDeposits(institutionId: string, limit?: number): Promise<DepositRecord[]>;
}
