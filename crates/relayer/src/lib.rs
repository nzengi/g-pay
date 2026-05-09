//! Fee-payer relayer for g-pay.
//!
//! Two layers:
//!  - Policy: rate limit (token bucket), per-tx fee accrual, monthly caps, suspension.
//!    Pure in-memory, single-thread testable. See `relayer::Relayer`.
//!  - Transport: HTTP service that accepts a base64-encoded `VersionedTransaction`,
//!    runs admission, signs as fee payer, and submits to a Solana RPC. See `bin/main.rs`.

#![deny(unsafe_code)]

mod billing;
mod error;
mod rate_limit;
mod relayer;
pub mod submit;

pub use billing::{BillingLedger, FeeQuote};
pub use error::RelayerError;
pub use rate_limit::TokenBucket;
pub use relayer::{InstitutionPolicy, Relayer, SubmissionDecision};
