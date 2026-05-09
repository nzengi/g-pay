use std::path::PathBuf;
use std::str::FromStr;

use anchor_lang::{InstructionData, ToAccountMetas};
use anyhow::{anyhow, Context, Result};
use clap::{Args, Parser, Subcommand};
use quarantine_vault::instructions::DepositArgs;
use quarantine_vault::state::AmlVerdict;
use rand::rngs::OsRng;
use solana_client::rpc_client::RpcClient;
use solana_commitment_config::CommitmentConfig;
use solana_instruction::Instruction;
use solana_keypair::{read_keypair_file, Keypair};
use solana_message::{Message, VersionedMessage};
use solana_pubkey::Pubkey;
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;
use stealth_core::{derive_stealth_address_with_nonce, SpendPublicKey, ViewPublicKey};

#[derive(Parser)]
#[command(version, about = "Operator CLI for the g-pay quarantine vault")]
struct Cli {
    /// RPC endpoint (defaults to local validator).
    #[arg(long, default_value = "http://127.0.0.1:8899", env = "GPAY_RPC_URL")]
    rpc: String,

    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Initialize a new vault with the given oracle set + threshold.
    InitVault(InitVault),
    /// Submit a SOL deposit to a freshly-derived stealth address.
    DepositSol(DepositSol),
    /// Sign an AML attestation for a deposit.
    Attest(Attest),
    /// Release an Approved deposit's SOL to a target address.
    ReleaseSol(ReleaseSol),
    /// Refund a Rejected/Expired deposit to its registered refund address.
    RefundSol(RefundSol),
}

#[derive(Args)]
struct InitVault {
    #[arg(long)]
    authority_keypair: PathBuf,
    /// Comma-separated oracle pubkeys.
    #[arg(long)]
    oracles: String,
    /// m of n attestations required.
    #[arg(long)]
    threshold: u8,
}

#[derive(Args)]
struct DepositSol {
    #[arg(long)]
    depositor_keypair: PathBuf,
    /// The vault authority pubkey (derives the vault PDA).
    #[arg(long)]
    vault_authority: String,
    /// Institution spend pub (32 byte hex).
    #[arg(long)]
    spend_pub_hex: String,
    /// Institution view pub (32 byte hex).
    #[arg(long)]
    view_pub_hex: String,
    /// Stealth derivation nonce (must match indexer slice nonce).
    #[arg(long, default_value_t = 0)]
    nonce: u64,
    #[arg(long)]
    amount_lamports: u64,
    /// Pubkey funds are returned to on rejection/expiry.
    #[arg(long)]
    refund_addr: String,
    /// Pubkey allowed to call `release` on this deposit.
    #[arg(long)]
    release_authority: String,
    #[arg(long, default_value_t = 3600)]
    expire_seconds: i64,
}

#[derive(Args)]
struct Attest {
    #[arg(long)]
    oracle_keypair: PathBuf,
    /// Vault authority pubkey (vault PDA seed).
    #[arg(long)]
    vault_authority: String,
    /// On-chain Deposit account pubkey.
    #[arg(long)]
    deposit_pubkey: String,
    /// On-chain Deposit account stealth_pubkey field.
    #[arg(long)]
    stealth_pubkey: String,
    /// On-chain Deposit account ephemeral_r field (64-char hex).
    #[arg(long)]
    ephemeral_r_hex: String,
    /// `clean` or `dirty`.
    #[arg(long)]
    verdict: String,
    /// 32-byte hex evidence hash.
    #[arg(
        long,
        default_value = "0000000000000000000000000000000000000000000000000000000000000000"
    )]
    evidence_hex: String,
}

#[derive(Args)]
struct ReleaseSol {
    #[arg(long)]
    release_authority_keypair: PathBuf,
    #[arg(long)]
    vault_authority: String,
    #[arg(long)]
    stealth_pubkey: String,
    #[arg(long)]
    ephemeral_r_hex: String,
    #[arg(long)]
    target: String,
}

#[derive(Args)]
struct RefundSol {
    #[arg(long)]
    caller_keypair: PathBuf,
    #[arg(long)]
    vault_authority: String,
    #[arg(long)]
    stealth_pubkey: String,
    #[arg(long)]
    ephemeral_r_hex: String,
    #[arg(long)]
    refund_target: String,
}

fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let cli = Cli::parse();
    let rpc = RpcClient::new_with_commitment(cli.rpc.clone(), CommitmentConfig::confirmed());

    match cli.cmd {
        Cmd::InitVault(a) => init_vault(&rpc, a),
        Cmd::DepositSol(a) => deposit_sol(&rpc, a),
        Cmd::Attest(a) => attest(&rpc, a),
        Cmd::ReleaseSol(a) => release_sol(&rpc, a),
        Cmd::RefundSol(a) => refund_sol(&rpc, a),
    }
}

fn program_id() -> Pubkey {
    quarantine_vault::id()
}

fn vault_pda(authority: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[quarantine_vault::VAULT_SEED, authority.as_ref()],
        &program_id(),
    )
    .0
}

fn deposit_pda(vault: &Pubkey, stealth: &Pubkey, ephemeral_r: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(
        &[
            quarantine_vault::DEPOSIT_SEED,
            vault.as_ref(),
            stealth.as_ref(),
            ephemeral_r,
        ],
        &program_id(),
    )
    .0
}

fn parse_hex32(s: &str) -> Result<[u8; 32]> {
    let v = hex::decode(s).context("hex decode")?;
    if v.len() != 32 {
        return Err(anyhow!("expected 32 bytes, got {}", v.len()));
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&v);
    Ok(out)
}

fn parse_pubkey(s: &str) -> Result<Pubkey> {
    Pubkey::from_str(s).with_context(|| format!("invalid pubkey {s}"))
}

fn submit(rpc: &RpcClient, ix: Instruction, signers: &[&Keypair]) -> Result<String> {
    let payer = signers
        .first()
        .ok_or_else(|| anyhow!("at least one signer required"))?;
    let blockhash = rpc.get_latest_blockhash()?;
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &signers.to_vec())
        .map_err(|e| anyhow!("sign tx: {e:?}"))?;
    let sig = rpc.send_and_confirm_transaction(&tx)?;
    Ok(sig.to_string())
}

fn init_vault(rpc: &RpcClient, a: InitVault) -> Result<()> {
    let authority = read_keypair_file(&a.authority_keypair)
        .map_err(|e| anyhow!("read authority keypair: {e}"))?;
    let oracle_set: Vec<Pubkey> = a
        .oracles
        .split(',')
        .map(|s| parse_pubkey(s.trim()))
        .collect::<Result<_>>()?;
    let vault = vault_pda(&authority.pubkey());

    let ix = Instruction {
        program_id: program_id(),
        accounts: quarantine_vault::accounts::InitializeVault {
            authority: authority.pubkey(),
            vault,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: quarantine_vault::instruction::InitializeVault {
            oracle_set,
            min_attestations: a.threshold,
        }
        .data(),
    };
    let sig = submit(rpc, ix, &[&authority])?;
    println!(
        "{}",
        serde_json::json!({
            "vault": vault.to_string(),
            "authority": authority.pubkey().to_string(),
            "signature": sig,
        })
    );
    Ok(())
}

fn deposit_sol(rpc: &RpcClient, a: DepositSol) -> Result<()> {
    let depositor = read_keypair_file(&a.depositor_keypair)
        .map_err(|e| anyhow!("read depositor keypair: {e}"))?;
    let vault_authority_pk = parse_pubkey(&a.vault_authority)?;
    let vault = vault_pda(&vault_authority_pk);
    let refund_addr = parse_pubkey(&a.refund_addr)?;
    let release_authority = parse_pubkey(&a.release_authority)?;

    let spend_bytes = parse_hex32(&a.spend_pub_hex)?;
    let view_bytes = parse_hex32(&a.view_pub_hex)?;
    let spend_pub =
        SpendPublicKey::from_bytes(&spend_bytes).map_err(|e| anyhow!("invalid spend_pub: {e}"))?;
    let view_pub: ViewPublicKey =
        ViewPublicKey::from_bytes(&view_bytes).map_err(|e| anyhow!("invalid view_pub: {e}"))?;

    let mut rng = OsRng;
    let stealth = derive_stealth_address_with_nonce(&spend_pub, &view_pub, a.nonce, &mut rng);

    let stealth_pk = Pubkey::new_from_array(stealth.stealth_pubkey);
    let deposit = deposit_pda(&vault, &stealth_pk, &stealth.ephemeral_r);

    let args = DepositArgs {
        stealth_pubkey: stealth_pk,
        ephemeral_r: stealth.ephemeral_r,
        view_tag: stealth.view_tag,
        amount: a.amount_lamports,
        refund_addr,
        release_authority,
        expire_seconds: a.expire_seconds,
    };

    let ix = Instruction {
        program_id: program_id(),
        accounts: quarantine_vault::accounts::MakeDeposit {
            depositor: depositor.pubkey(),
            vault,
            deposit,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: quarantine_vault::instruction::Deposit { args }.data(),
    };

    let sig = submit(rpc, ix, &[&depositor])?;
    println!(
        "{}",
        serde_json::json!({
            "deposit_pda": deposit.to_string(),
            "vault": vault.to_string(),
            "stealth_pubkey": stealth_pk.to_string(),
            "stealth_pubkey_hex": hex::encode(stealth.stealth_pubkey),
            "ephemeral_r_hex": hex::encode(stealth.ephemeral_r),
            "view_tag": stealth.view_tag,
            "signature": sig,
        })
    );
    Ok(())
}

fn attest(rpc: &RpcClient, a: Attest) -> Result<()> {
    let oracle =
        read_keypair_file(&a.oracle_keypair).map_err(|e| anyhow!("read oracle keypair: {e}"))?;
    let vault_authority_pk = parse_pubkey(&a.vault_authority)?;
    let vault = vault_pda(&vault_authority_pk);
    let stealth_pk = parse_pubkey(&a.stealth_pubkey)?;
    let ephemeral_r = parse_hex32(&a.ephemeral_r_hex)?;
    let deposit = deposit_pda(&vault, &stealth_pk, &ephemeral_r);

    let verdict = match a.verdict.as_str() {
        "clean" => AmlVerdict::Clean,
        "dirty" => AmlVerdict::Dirty,
        other => return Err(anyhow!("verdict must be clean|dirty, got {other}")),
    };
    let evidence = parse_hex32(&a.evidence_hex)?;

    let ix = Instruction {
        program_id: program_id(),
        accounts: quarantine_vault::accounts::Attest {
            oracle: oracle.pubkey(),
            vault,
            deposit,
        }
        .to_account_metas(None),
        data: quarantine_vault::instruction::Attest {
            verdict,
            evidence_hash: evidence,
        }
        .data(),
    };

    let sig = submit(rpc, ix, &[&oracle])?;
    println!(
        "{}",
        serde_json::json!({
            "deposit": deposit.to_string(),
            "oracle": oracle.pubkey().to_string(),
            "verdict": a.verdict,
            "signature": sig,
        })
    );
    Ok(())
}

fn release_sol(rpc: &RpcClient, a: ReleaseSol) -> Result<()> {
    let release_kp = read_keypair_file(&a.release_authority_keypair)
        .map_err(|e| anyhow!("read release authority keypair: {e}"))?;
    let vault = vault_pda(&parse_pubkey(&a.vault_authority)?);
    let stealth = parse_pubkey(&a.stealth_pubkey)?;
    let ephemeral_r = parse_hex32(&a.ephemeral_r_hex)?;
    let deposit = deposit_pda(&vault, &stealth, &ephemeral_r);
    let target = parse_pubkey(&a.target)?;

    let ix = Instruction {
        program_id: program_id(),
        accounts: quarantine_vault::accounts::Release {
            release_authority: release_kp.pubkey(),
            vault,
            deposit,
            target,
        }
        .to_account_metas(None),
        data: quarantine_vault::instruction::Release {}.data(),
    };

    let sig = submit(rpc, ix, &[&release_kp])?;
    println!(
        "{}",
        serde_json::json!({ "deposit": deposit.to_string(), "target": target.to_string(), "signature": sig })
    );
    Ok(())
}

fn refund_sol(rpc: &RpcClient, a: RefundSol) -> Result<()> {
    let caller =
        read_keypair_file(&a.caller_keypair).map_err(|e| anyhow!("read caller keypair: {e}"))?;
    let vault = vault_pda(&parse_pubkey(&a.vault_authority)?);
    let stealth = parse_pubkey(&a.stealth_pubkey)?;
    let ephemeral_r = parse_hex32(&a.ephemeral_r_hex)?;
    let deposit = deposit_pda(&vault, &stealth, &ephemeral_r);
    let refund_target = parse_pubkey(&a.refund_target)?;

    let ix = Instruction {
        program_id: program_id(),
        accounts: quarantine_vault::accounts::Refund {
            caller: caller.pubkey(),
            vault,
            deposit,
            refund_target,
        }
        .to_account_metas(None),
        data: quarantine_vault::instruction::Refund {}.data(),
    };

    let sig = submit(rpc, ix, &[&caller])?;
    println!(
        "{}",
        serde_json::json!({ "deposit": deposit.to_string(), "refund_target": refund_target.to_string(), "signature": sig })
    );
    Ok(())
}
