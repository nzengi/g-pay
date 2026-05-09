use anchor_lang::prelude::*;

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

#[constant]
pub const DEPOSIT_SEED: &[u8] = b"deposit";

#[constant]
pub const ESCROW_TOKEN_SEED: &[u8] = b"escrow_token";

pub const MAX_ORACLES: usize = 16;

pub const MAX_ATTESTATIONS: usize = 16;

#[constant]
pub const MIN_EXPIRE_SECONDS: i64 = 60;

#[constant]
pub const MAX_EXPIRE_SECONDS: i64 = 60 * 60 * 24 * 30;
