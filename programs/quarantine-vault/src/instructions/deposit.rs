use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::{DEPOSIT_SEED, MAX_EXPIRE_SECONDS, MIN_EXPIRE_SECONDS, VAULT_SEED};
use crate::error::VaultError;
use crate::state::{Deposit, DepositState, Vault};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DepositArgs {
    pub stealth_pubkey: Pubkey,
    pub ephemeral_r: [u8; 32],
    pub view_tag: u8,
    pub amount: u64,
    pub refund_addr: Pubkey,
    pub release_authority: Pubkey,
    pub expire_seconds: i64,
}

#[derive(Accounts)]
#[instruction(args: DepositArgs)]
pub struct MakeDeposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.authority.as_ref()],
        bump = vault.bump,
        constraint = !vault.paused @ VaultError::Paused,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = depositor,
        space = 8 + Deposit::INIT_SPACE,
        seeds = [
            DEPOSIT_SEED,
            vault.key().as_ref(),
            args.stealth_pubkey.as_ref(),
            &args.ephemeral_r,
        ],
        bump,
    )]
    pub deposit: Account<'info, Deposit>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<MakeDeposit>, args: DepositArgs) -> Result<()> {
    require!(args.amount > 0, VaultError::InvalidAmount);
    require!(
        args.expire_seconds >= MIN_EXPIRE_SECONDS && args.expire_seconds <= MAX_EXPIRE_SECONDS,
        VaultError::InvalidExpiry
    );

    let now = Clock::get()?.unix_timestamp;
    let vault = &mut ctx.accounts.vault;
    let deposit = &mut ctx.accounts.deposit;

    deposit.bump = ctx.bumps.deposit;
    deposit.vault = vault.key();
    deposit.stealth_pubkey = args.stealth_pubkey;
    deposit.ephemeral_r = args.ephemeral_r;
    deposit.view_tag = args.view_tag;
    deposit.mint = Pubkey::default();
    deposit.amount = args.amount;
    deposit.depositor = ctx.accounts.depositor.key();
    deposit.refund_addr = args.refund_addr;
    deposit.release_authority = args.release_authority;
    deposit.created_at = now;
    deposit.expire_at = now.saturating_add(args.expire_seconds);
    deposit.state = DepositState::Pending;
    deposit.attestations = Vec::new();
    deposit.clean_count = 0;
    deposit.dirty_count = 0;

    let cpi = system_program::Transfer {
        from: ctx.accounts.depositor.to_account_info(),
        to: ctx.accounts.deposit.to_account_info(),
    };
    system_program::transfer(
        CpiContext::new(anchor_lang::system_program::ID, cpi),
        args.amount,
    )?;

    vault.deposit_count = vault.deposit_count.saturating_add(1);

    Ok(())
}
