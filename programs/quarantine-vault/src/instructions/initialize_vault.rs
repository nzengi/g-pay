use anchor_lang::prelude::*;

use crate::constants::{MAX_ORACLES, VAULT_SEED};
use crate::error::VaultError;
use crate::state::Vault;

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, authority.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeVault>,
    oracle_set: Vec<Pubkey>,
    min_attestations: u8,
) -> Result<()> {
    require!(oracle_set.len() <= MAX_ORACLES, VaultError::TooManyOracles);
    require!(
        min_attestations as usize >= 1 && (min_attestations as usize) <= oracle_set.len(),
        VaultError::InvalidThreshold
    );

    let vault = &mut ctx.accounts.vault;
    vault.bump = ctx.bumps.vault;
    vault.authority = ctx.accounts.authority.key();
    vault.oracle_set = oracle_set;
    vault.min_attestations = min_attestations;
    vault.paused = false;
    vault.deposit_count = 0;

    Ok(())
}
