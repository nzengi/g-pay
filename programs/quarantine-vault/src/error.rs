use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Vault is paused")]
    Paused,

    #[msg("Caller is not an authorized AML oracle")]
    UnauthorizedOracle,

    #[msg("Oracle has already attested for this deposit")]
    DuplicateAttestation,

    #[msg("Oracle set exceeds MAX_ORACLES")]
    TooManyOracles,

    #[msg("min_attestations must be between 1 and oracle_set.len()")]
    InvalidThreshold,

    #[msg("Deposit is not in the expected state")]
    InvalidState,

    #[msg("Deposit has not yet expired")]
    NotYetExpired,

    #[msg("Deposit has already expired")]
    AlreadyExpired,

    #[msg("expire_seconds is out of allowed range")]
    InvalidExpiry,

    #[msg("Amount must be greater than zero")]
    InvalidAmount,

    #[msg("Attestation verdict is inconsistent with current outcome")]
    ConflictingVerdict,

    #[msg("Refund authority mismatch")]
    InvalidRefundAuthority,

    #[msg("Release authority mismatch")]
    InvalidReleaseAuthority,
}
