use anyhow::{Context, Result};
use serde::Serialize;

use crate::PaymentMatch;

#[derive(Debug, Serialize)]
struct WebhookBody<'a> {
    slice_id: u64,
    deposit_pubkey: String,
    stealth_pubkey: String,
    amount: u64,
    state: &'a str,
}

pub fn notify_match(
    client: &reqwest::blocking::Client,
    gateway_url: &str,
    secret: &str,
    m: &PaymentMatch,
) -> Result<()> {
    let url = format!(
        "{}/v1/internal/deposit-detected",
        gateway_url.trim_end_matches('/')
    );
    let state = match m.state {
        quarantine_vault::state::DepositState::Pending => "pending",
        quarantine_vault::state::DepositState::Approved => "approved",
        quarantine_vault::state::DepositState::Rejected => "rejected",
        quarantine_vault::state::DepositState::Released => "released",
        quarantine_vault::state::DepositState::Refunded => "refunded",
        quarantine_vault::state::DepositState::Expired => "expired",
    };
    let body = WebhookBody {
        slice_id: m.slice_id.0,
        deposit_pubkey: m.deposit_pubkey.to_string(),
        stealth_pubkey: m.stealth_pubkey.to_string(),
        amount: m.amount,
        state,
    };
    let res = client
        .post(&url)
        .header("x-internal-secret", secret)
        .json(&body)
        .send()
        .context("posting match webhook")?;
    if !res.status().is_success() {
        anyhow::bail!(
            "gateway returned {} for /v1/internal/deposit-detected",
            res.status()
        );
    }
    Ok(())
}
