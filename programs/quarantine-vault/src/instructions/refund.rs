use anchor_lang::prelude::*;

use crate::constants::{DEPOSIT_SEED, VAULT_SEED};
use crate::error::VaultError;
use crate::state::{Deposit, DepositState, Vault};

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

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
    )]
    pub deposit: Account<'info, Deposit>,

    /// CHECK: must equal deposit.refund_addr; verified in handler.
    #[account(mut)]
    pub refund_target: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<Refund>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let deposit = &mut ctx.accounts.deposit;

    let allowed = match deposit.state {
        DepositState::Rejected => true,
        DepositState::Pending if now >= deposit.expire_at => {
            deposit.state = DepositState::Expired;
            true
        }
        DepositState::Expired => true,
        _ => false,
    };
    require!(allowed, VaultError::InvalidState);

    require!(
        ctx.accounts.refund_target.key() == deposit.refund_addr,
        VaultError::InvalidRefundAuthority
    );

    let amount = deposit.amount;
    let deposit_info = deposit.to_account_info();
    let target_info = ctx.accounts.refund_target.to_account_info();

    let current = deposit_info.lamports();
    let new_balance = current
        .checked_sub(amount)
        .ok_or(ProgramError::InsufficientFunds)?;
    **deposit_info.try_borrow_mut_lamports()? = new_balance;
    **target_info.try_borrow_mut_lamports()? = target_info
        .lamports()
        .checked_add(amount)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    ctx.accounts.deposit.state = DepositState::Refunded;
    Ok(())
}
