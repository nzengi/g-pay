use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::{
    DEPOSIT_SEED, ESCROW_TOKEN_SEED, MAX_EXPIRE_SECONDS, MIN_EXPIRE_SECONDS, VAULT_SEED,
};
use crate::error::VaultError;
use crate::instructions::deposit::DepositArgs;
use crate::state::{Deposit, DepositState, Vault};

#[derive(Accounts)]
#[instruction(args: DepositArgs)]
pub struct DepositToken<'info> {
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

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = depositor_token_account.mint == mint.key(),
        constraint = depositor_token_account.owner == depositor.key(),
    )]
    pub depositor_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = depositor,
        seeds = [ESCROW_TOKEN_SEED, deposit.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = deposit,
        token::token_program = token_program,
    )]
    pub escrow_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositToken>, args: DepositArgs) -> Result<()> {
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
    deposit.mint = ctx.accounts.mint.key();
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

    let cpi = TransferChecked {
        from: ctx.accounts.depositor_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.escrow_token_account.to_account_info(),
        authority: ctx.accounts.depositor.to_account_info(),
    };
    token_interface::transfer_checked(
        CpiContext::new(ctx.accounts.token_program.key(), cpi),
        args.amount,
        ctx.accounts.mint.decimals,
    )?;

    vault.deposit_count = vault.deposit_count.saturating_add(1);

    Ok(())
}
