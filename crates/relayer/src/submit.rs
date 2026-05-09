use anyhow::{anyhow, Context, Result};
use base64::Engine;
use solana_client::rpc_client::RpcClient;
use solana_commitment_config::CommitmentConfig;
use solana_keypair::Keypair;
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;

/// Decode a base64-encoded `VersionedTransaction`.
pub fn decode_tx_b64(b64: &str) -> Result<VersionedTransaction> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64.as_bytes())
        .context("base64 decode")?;
    bincode::deserialize::<VersionedTransaction>(&bytes).context("bincode deserialize")
}

/// Re-sign a transaction so that `fee_payer` is the first signer.
///
/// Expects the message's first static account key to already equal `fee_payer.pubkey()`
/// (the caller built the message with the relayer as fee payer); other signatures the
/// caller already collected are preserved.
pub fn cosign_as_fee_payer(
    mut tx: VersionedTransaction,
    fee_payer: &Keypair,
) -> Result<VersionedTransaction> {
    let header = tx.message.header();
    let static_keys = tx.message.static_account_keys();
    let expected_fee_payer = static_keys
        .first()
        .ok_or_else(|| anyhow!("message has no static accounts"))?;
    if expected_fee_payer != &fee_payer.pubkey() {
        return Err(anyhow!(
            "message fee-payer slot is {expected_fee_payer}, relayer expected {}",
            fee_payer.pubkey()
        ));
    }

    let num_required = header.num_required_signatures as usize;
    if tx.signatures.len() != num_required {
        tx.signatures
            .resize(num_required, solana_sdk::signature::Signature::default());
    }
    let message_data = tx.message.serialize();
    let signature = fee_payer.sign_message(&message_data);
    tx.signatures[0] = signature;
    Ok(tx)
}

/// Submit and confirm at the configured commitment level.
pub fn send_and_confirm(rpc: &RpcClient, tx: &VersionedTransaction) -> Result<String> {
    let sig = rpc
        .send_and_confirm_transaction_with_spinner_and_commitment(tx, CommitmentConfig::confirmed())
        .context("send_and_confirm_transaction")?;
    Ok(sig.to_string())
}
