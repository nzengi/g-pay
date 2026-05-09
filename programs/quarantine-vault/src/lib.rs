pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("75HuPfb2n7SD7KtcQnVpCW5SVN3RP9gZ9vTXP4D4ha6C");

#[program]
pub mod quarantine_vault {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        oracle_set: Vec<Pubkey>,
        min_attestations: u8,
    ) -> Result<()> {
        instructions::initialize_vault::handler(ctx, oracle_set, min_attestations)
    }

    pub fn deposit(ctx: Context<MakeDeposit>, args: DepositArgs) -> Result<()> {
        instructions::deposit::handler(ctx, args)
    }

    pub fn deposit_token(ctx: Context<DepositToken>, args: DepositArgs) -> Result<()> {
        instructions::deposit_token::handler(ctx, args)
    }

    pub fn attest(
        ctx: Context<Attest>,
        verdict: AmlVerdict,
        evidence_hash: [u8; 32],
    ) -> Result<()> {
        instructions::attest::handler(ctx, verdict, evidence_hash)
    }

    pub fn release(ctx: Context<Release>) -> Result<()> {
        instructions::release::handler(ctx)
    }

    pub fn release_token(ctx: Context<ReleaseToken>) -> Result<()> {
        instructions::release_token::handler(ctx)
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        instructions::refund::handler(ctx)
    }

    pub fn refund_token(ctx: Context<RefundToken>) -> Result<()> {
        instructions::refund_token::handler(ctx)
    }
}
