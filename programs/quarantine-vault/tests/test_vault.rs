use {
    anchor_lang::{
        solana_program::{instruction::Instruction, pubkey::Pubkey},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    quarantine_vault::{
        instructions::DepositArgs,
        state::{AmlVerdict, Deposit, DepositState, Vault},
        DEPOSIT_SEED, VAULT_SEED,
    },
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const PROGRAM_SO: &[u8] = include_bytes!("../../../target/deploy/quarantine_vault.so");
const ONE_SOL: u64 = 1_000_000_000;
const DEPOSIT_AMOUNT: u64 = 100_000_000;

struct Fixture {
    svm: LiteSVM,
    program_id: Pubkey,
    authority: Keypair,
    oracles: [Keypair; 3],
    depositor: Keypair,
    refund_target: Pubkey,
    release_authority: Keypair,
    target_stealth: Pubkey,
    stealth_pubkey: Pubkey,
    ephemeral_r: [u8; 32],
}

fn setup() -> Fixture {
    let program_id = quarantine_vault::id();
    let mut svm = LiteSVM::new();
    svm.add_program(program_id, PROGRAM_SO).unwrap();

    let authority = Keypair::new();
    let depositor = Keypair::new();
    let release_authority = Keypair::new();
    let oracles = [Keypair::new(), Keypair::new(), Keypair::new()];

    svm.airdrop(&authority.pubkey(), 10 * ONE_SOL).unwrap();
    svm.airdrop(&depositor.pubkey(), 10 * ONE_SOL).unwrap();
    svm.airdrop(&release_authority.pubkey(), ONE_SOL).unwrap();
    for o in &oracles {
        svm.airdrop(&o.pubkey(), ONE_SOL).unwrap();
    }

    let refund_target = Keypair::new().pubkey();
    let target_stealth = Keypair::new().pubkey();
    let stealth_pubkey = Keypair::new().pubkey();

    let mut ephemeral_r = [0u8; 32];
    ephemeral_r[0] = 0xab;
    ephemeral_r[31] = 0xcd;

    Fixture {
        svm,
        program_id,
        authority,
        oracles,
        depositor,
        refund_target,
        release_authority,
        target_stealth,
        stealth_pubkey,
        ephemeral_r,
    }
}

impl Fixture {
    fn vault_pda(&self) -> Pubkey {
        Pubkey::find_program_address(
            &[VAULT_SEED, self.authority.pubkey().as_ref()],
            &self.program_id,
        )
        .0
    }

    fn deposit_pda(&self) -> Pubkey {
        Pubkey::find_program_address(
            &[
                DEPOSIT_SEED,
                self.vault_pda().as_ref(),
                self.stealth_pubkey.as_ref(),
                &self.ephemeral_r,
            ],
            &self.program_id,
        )
        .0
    }

    fn ix_initialize(&self, threshold: u8) -> Instruction {
        Instruction::new_with_bytes(
            self.program_id,
            &quarantine_vault::instruction::InitializeVault {
                oracle_set: self.oracles.iter().map(|o| o.pubkey()).collect(),
                min_attestations: threshold,
            }
            .data(),
            quarantine_vault::accounts::InitializeVault {
                authority: self.authority.pubkey(),
                vault: self.vault_pda(),
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
        )
    }

    fn ix_deposit(&self) -> Instruction {
        Instruction::new_with_bytes(
            self.program_id,
            &quarantine_vault::instruction::Deposit {
                args: DepositArgs {
                    stealth_pubkey: self.stealth_pubkey,
                    ephemeral_r: self.ephemeral_r,
                    view_tag: 0x42,
                    amount: DEPOSIT_AMOUNT,
                    refund_addr: self.refund_target,
                    release_authority: self.release_authority.pubkey(),
                    expire_seconds: 3600,
                },
            }
            .data(),
            quarantine_vault::accounts::MakeDeposit {
                depositor: self.depositor.pubkey(),
                vault: self.vault_pda(),
                deposit: self.deposit_pda(),
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
        )
    }

    fn ix_attest(&self, oracle_idx: usize, verdict: AmlVerdict) -> Instruction {
        Instruction::new_with_bytes(
            self.program_id,
            &quarantine_vault::instruction::Attest {
                verdict,
                evidence_hash: [oracle_idx as u8; 32],
            }
            .data(),
            quarantine_vault::accounts::Attest {
                oracle: self.oracles[oracle_idx].pubkey(),
                vault: self.vault_pda(),
                deposit: self.deposit_pda(),
            }
            .to_account_metas(None),
        )
    }

    fn ix_release(&self) -> Instruction {
        Instruction::new_with_bytes(
            self.program_id,
            &quarantine_vault::instruction::Release {}.data(),
            quarantine_vault::accounts::Release {
                release_authority: self.release_authority.pubkey(),
                vault: self.vault_pda(),
                deposit: self.deposit_pda(),
                target: self.target_stealth,
            }
            .to_account_metas(None),
        )
    }

    fn ix_refund(&self, caller: &Pubkey) -> Instruction {
        Instruction::new_with_bytes(
            self.program_id,
            &quarantine_vault::instruction::Refund {}.data(),
            quarantine_vault::accounts::Refund {
                caller: *caller,
                vault: self.vault_pda(),
                deposit: self.deposit_pda(),
                refund_target: self.refund_target,
            }
            .to_account_metas(None),
        )
    }

    fn run(&mut self, ix: Instruction, signers: &[&Keypair]) -> Result<(), String> {
        let payer = signers[0];
        let blockhash = self.svm.latest_blockhash();
        let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &signers.to_vec())
            .map_err(|e| format!("sign failed: {e:?}"))?;
        self.svm
            .send_transaction(tx)
            .map(|_| ())
            .map_err(|e| format!("{e:?}"))
    }

    fn read_vault(&self) -> Vault {
        let acct = self
            .svm
            .get_account(&self.vault_pda())
            .expect("vault must exist");
        Vault::try_deserialize(&mut &acct.data[..]).expect("vault deserialize")
    }

    fn read_deposit(&self) -> Deposit {
        let acct = self
            .svm
            .get_account(&self.deposit_pda())
            .expect("deposit must exist");
        Deposit::try_deserialize(&mut &acct.data[..]).expect("deposit deserialize")
    }
}

#[test]
fn initialize_vault_succeeds() {
    let mut f = setup();
    let auth = f.authority.insecure_clone();
    let ix = f.ix_initialize(2);
    f.run(ix, &[&auth]).expect("init");

    let vault = f.read_vault();
    assert_eq!(vault.authority, f.authority.pubkey());
    assert_eq!(vault.min_attestations, 2);
    assert_eq!(vault.oracle_set.len(), 3);
    assert!(!vault.paused);
    assert_eq!(vault.deposit_count, 0);
}

#[test]
fn happy_path_deposit_attest_release() {
    let mut f = setup();
    let auth = f.authority.insecure_clone();
    let dep = f.depositor.insecure_clone();
    let o0 = f.oracles[0].insecure_clone();
    let o1 = f.oracles[1].insecure_clone();
    let release = f.release_authority.insecure_clone();

    let ix = f.ix_initialize(2);
    f.run(ix, &[&auth]).expect("init");

    let ix = f.ix_deposit();
    f.run(ix, &[&dep]).expect("deposit");

    let dep_state = f.read_deposit();
    assert_eq!(dep_state.state, DepositState::Pending);
    assert_eq!(dep_state.amount, DEPOSIT_AMOUNT);
    assert_eq!(dep_state.stealth_pubkey, f.stealth_pubkey);
    let deposit_lamports = f.svm.get_balance(&f.deposit_pda()).unwrap_or(0);
    assert!(
        deposit_lamports > DEPOSIT_AMOUNT,
        "deposit account holds rent + amount, got {deposit_lamports}"
    );

    let ix = f.ix_attest(0, AmlVerdict::Clean);
    f.run(ix, &[&o0]).expect("attest 0");

    let dep1 = f.read_deposit();
    assert_eq!(dep1.state, DepositState::Pending);
    assert_eq!(dep1.clean_count, 1);

    let ix = f.ix_attest(1, AmlVerdict::Clean);
    f.run(ix, &[&o1]).expect("attest 1");

    let dep2 = f.read_deposit();
    assert_eq!(dep2.state, DepositState::Approved);
    assert_eq!(dep2.clean_count, 2);

    let target_before = f.svm.get_balance(&f.target_stealth).unwrap_or(0);

    let ix = f.ix_release();
    f.run(ix, &[&release]).expect("release");

    let dep_final = f.read_deposit();
    assert_eq!(dep_final.state, DepositState::Released);

    let target_after = f.svm.get_balance(&f.target_stealth).unwrap_or(0);
    assert_eq!(target_after - target_before, DEPOSIT_AMOUNT);
}

#[test]
fn reject_path_dirty_attest_refund() {
    let mut f = setup();
    let auth = f.authority.insecure_clone();
    let dep = f.depositor.insecure_clone();
    let o0 = f.oracles[0].insecure_clone();
    let o1 = f.oracles[1].insecure_clone();

    let ix = f.ix_initialize(2);
    f.run(ix, &[&auth]).expect("init");
    let ix = f.ix_deposit();
    f.run(ix, &[&dep]).expect("deposit");

    let ix = f.ix_attest(0, AmlVerdict::Dirty);
    f.run(ix, &[&o0]).expect("dirty attest 0");
    let ix = f.ix_attest(1, AmlVerdict::Dirty);
    f.run(ix, &[&o1]).expect("dirty attest 1");

    let dep_state = f.read_deposit();
    assert_eq!(dep_state.state, DepositState::Rejected);
    assert_eq!(dep_state.dirty_count, 2);

    let refund_before = f.svm.get_balance(&f.refund_target).unwrap_or(0);
    let depositor_pk = f.depositor.pubkey();
    let ix = f.ix_refund(&depositor_pk);
    f.run(ix, &[&dep]).expect("refund");

    let dep_final = f.read_deposit();
    assert_eq!(dep_final.state, DepositState::Refunded);

    let refund_after = f.svm.get_balance(&f.refund_target).unwrap_or(0);
    assert_eq!(refund_after - refund_before, DEPOSIT_AMOUNT);
}

#[test]
fn unauthorized_oracle_rejected() {
    let mut f = setup();
    let auth = f.authority.insecure_clone();
    let dep = f.depositor.insecure_clone();
    let stranger = Keypair::new();
    f.svm.airdrop(&stranger.pubkey(), ONE_SOL).unwrap();

    let ix = f.ix_initialize(2);
    f.run(ix, &[&auth]).expect("init");
    let ix = f.ix_deposit();
    f.run(ix, &[&dep]).expect("deposit");

    let bad = Instruction::new_with_bytes(
        f.program_id,
        &quarantine_vault::instruction::Attest {
            verdict: AmlVerdict::Clean,
            evidence_hash: [0u8; 32],
        }
        .data(),
        quarantine_vault::accounts::Attest {
            oracle: stranger.pubkey(),
            vault: f.vault_pda(),
            deposit: f.deposit_pda(),
        }
        .to_account_metas(None),
    );
    let res = f.run(bad, &[&stranger]);
    assert!(res.is_err(), "unauthorized oracle must fail");
}

#[test]
fn duplicate_attestation_rejected() {
    let mut f = setup();
    let auth = f.authority.insecure_clone();
    let dep = f.depositor.insecure_clone();
    let o0 = f.oracles[0].insecure_clone();

    let ix = f.ix_initialize(2);
    f.run(ix, &[&auth]).expect("init");
    let ix = f.ix_deposit();
    f.run(ix, &[&dep]).expect("deposit");

    let ix = f.ix_attest(0, AmlVerdict::Clean);
    f.run(ix, &[&o0]).expect("first attest");

    let ix = f.ix_attest(0, AmlVerdict::Clean);
    let res = f.run(ix, &[&o0]);
    assert!(res.is_err(), "duplicate attest from same oracle must fail");
}

#[test]
fn release_fails_before_approval() {
    let mut f = setup();
    let auth = f.authority.insecure_clone();
    let dep = f.depositor.insecure_clone();
    let release = f.release_authority.insecure_clone();

    let ix = f.ix_initialize(2);
    f.run(ix, &[&auth]).expect("init");
    let ix = f.ix_deposit();
    f.run(ix, &[&dep]).expect("deposit");

    let ix = f.ix_release();
    let res = f.run(ix, &[&release]);
    assert!(res.is_err(), "release before approval must fail");
}
