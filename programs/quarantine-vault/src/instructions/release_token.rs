use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::{DEPOSIT_SEED, ESCROW_TOKEN_SEED, VAULT_SEED};
use crate::error::VaultError;
use crate::state::{Deposit, DepositState, Vault};

#[derive(Accounts)]
pub struct ReleaseToken<'info> {
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
        constraint = deposit.mint == mint.key(),
    )]
    pub deposit: Account<'info, Deposit>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [ESCROW_TOKEN_SEED, deposit.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = deposit,
        token::token_program = token_program,
    )]
    pub escrow_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = target_token_account.mint == mint.key(),
    )]
    pub target_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<ReleaseToken>) -> Result<()> {
    let amount = ctx.accounts.deposit.amount;
    let decimals = ctx.accounts.mint.decimals;

    let bump = ctx.accounts.deposit.bump;
    let vault_key = ctx.accounts.vault.key();
    let stealth_pubkey = ctx.accounts.deposit.stealth_pubkey;
    let ephemeral_r = ctx.accounts.deposit.ephemeral_r;

    let seeds: &[&[u8]] = &[
        DEPOSIT_SEED,
        vault_key.as_ref(),
        stealth_pubkey.as_ref(),
        &ephemeral_r,
        std::slice::from_ref(&bump),
    ];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    let cpi = TransferChecked {
        from: ctx.accounts.escrow_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.target_token_account.to_account_info(),
        authority: ctx.accounts.deposit.to_account_info(),
    };
    token_interface::transfer_checked(
        CpiContext::new_with_signer(ctx.accounts.token_program.key(), cpi, signer_seeds),
        amount,
        decimals,
    )?;

    ctx.accounts.deposit.state = DepositState::Released;
    Ok(())
}
