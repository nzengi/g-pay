use anchor_lang::prelude::*;

use crate::constants::{MAX_ATTESTATIONS, MAX_ORACLES};

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub bump: u8,
    pub authority: Pubkey,
    #[max_len(MAX_ORACLES)]
    pub oracle_set: Vec<Pubkey>,
    pub min_attestations: u8,
    pub paused: bool,
    pub deposit_count: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Deposit {
    pub bump: u8,
    pub vault: Pubkey,

    pub stealth_pubkey: Pubkey,
    pub ephemeral_r: [u8; 32],
    pub view_tag: u8,

    pub mint: Pubkey,
    pub amount: u64,

    pub depositor: Pubkey,
    pub refund_addr: Pubkey,

    pub release_authority: Pubkey,

    pub created_at: i64,
    pub expire_at: i64,

    pub state: DepositState,

    #[max_len(MAX_ATTESTATIONS)]
    pub attestations: Vec<Attestation>,

    pub clean_count: u8,
    pub dirty_count: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum DepositState {
    Pending,
    Approved,
    Rejected,
    Released,
    Refunded,
    Expired,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum AmlVerdict {
    Clean,
    Dirty,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace, Debug)]
pub struct Attestation {
    pub oracle: Pubkey,
    pub verdict: AmlVerdict,
    pub timestamp: i64,
    pub evidence_hash: [u8; 32],
}
