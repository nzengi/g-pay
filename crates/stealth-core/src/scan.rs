use crate::error::StealthError;
use crate::keys::{SpendPublicKey, ViewKey};
use crate::stealth::{derive_for_recipient, shared_secret, view_tag};

#[derive(Debug, Clone)]
pub struct ScanResult {
    pub matched: bool,
    pub stealth_pubkey: [u8; 32],
}

pub fn scan_deposit(
    view: &ViewKey,
    spend_pub: &SpendPublicKey,
    candidate_stealth: &[u8; 32],
    ephemeral_r: &[u8; 32],
    chain_view_tag: u8,
    nonce: u64,
) -> Result<ScanResult, StealthError> {
    let shared = shared_secret(view, ephemeral_r)?;

    if view_tag(&shared) != chain_view_tag {
        return Ok(ScanResult {
            matched: false,
            stealth_pubkey: *candidate_stealth,
        });
    }

    let derived = derive_for_recipient(spend_pub, &shared, nonce);
    Ok(ScanResult {
        matched: derived == *candidate_stealth,
        stealth_pubkey: derived,
    })
}
