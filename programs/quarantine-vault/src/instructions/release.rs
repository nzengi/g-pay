use anchor_lang::prelude::*;

use crate::constants::{DEPOSIT_SEED, VAULT_SEED};
use crate::error::VaultError;
use crate::state::{Deposit, DepositState, Vault};

#[derive(Accounts)]
pub struct Release<'info> {
    #[account(mut)]
    pub release_authority: Signer<'info>,

    #[account(
        seeds = [VAULT_SEED, vault.authority.as_ref()],
        bump = vault.bump,
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
        constraint = deposit.state == DepositState::Approved @ VaultError::InvalidState,
        constraint = deposit.release_authority == release_authority.key() @ VaultError::InvalidReleaseAuthority,
    )]
    pub deposit: Account<'info, Deposit>,

    /// CHECK: target stealth address chosen off-chain by the institution.
    #[account(mut)]
    pub target: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<Release>) -> Result<()> {
    let amount = ctx.accounts.deposit.amount;
    let deposit_info = ctx.accounts.deposit.to_account_info();
    let target_info = ctx.accounts.target.to_account_info();

    let current = deposit_info.lamports();
    let new_balance = current
        .checked_sub(amount)
        .ok_or(ProgramError::InsufficientFunds)?;
    **deposit_info.try_borrow_mut_lamports()? = new_balance;
    **target_info.try_borrow_mut_lamports()? = target_info
        .lamports()
        .checked_add(amount)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    ctx.accounts.deposit.state = DepositState::Released;
    Ok(())
}
