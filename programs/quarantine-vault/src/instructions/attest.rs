use anchor_lang::prelude::*;

use crate::constants::{DEPOSIT_SEED, VAULT_SEED};
use crate::error::VaultError;
use crate::state::{AmlVerdict, Attestation, Deposit, DepositState, Vault};

#[derive(Accounts)]
pub struct Attest<'info> {
    pub oracle: Signer<'info>,

    #[account(
        seeds = [VAULT_SEED, vault.authority.as_ref()],
        bump = vault.bump,
        constraint = !vault.paused @ VaultError::Paused,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [
            DEPOSIT_SEED,
            vault.key().as_ref(),
            deposit.stealth_pubkey.as_ref(),
            &deposit.ephemeral_r,
        ],
        bump = deposit.bump,
    )]
    pub deposit: Account<'info, Deposit>,
}

pub fn handler(ctx: Context<Attest>, verdict: AmlVerdict, evidence_hash: [u8; 32]) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let deposit = &mut ctx.accounts.deposit;

    require!(
        deposit.state == DepositState::Pending,
        VaultError::InvalidState
    );

    let oracle_key = ctx.accounts.oracle.key();
    require!(
        vault.oracle_set.iter().any(|k| k == &oracle_key),
        VaultError::UnauthorizedOracle
    );

    require!(
        deposit.attestations.iter().all(|a| a.oracle != oracle_key),
        VaultError::DuplicateAttestation
    );

    let now = Clock::get()?.unix_timestamp;
    require!(now < deposit.expire_at, VaultError::AlreadyExpired);

    deposit.attestations.push(Attestation {
        oracle: oracle_key,
        verdict,
        timestamp: now,
        evidence_hash,
    });

    match verdict {
        AmlVerdict::Clean => deposit.clean_count = deposit.clean_count.saturating_add(1),
        AmlVerdict::Dirty => deposit.dirty_count = deposit.dirty_count.saturating_add(1),
    }

    let threshold = vault.min_attestations;

    if deposit.dirty_count >= threshold {
        deposit.state = DepositState::Rejected;
    } else if deposit.clean_count >= threshold {
        deposit.state = DepositState::Approved;
    }

    Ok(())
}
