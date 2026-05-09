//! Ed25519 stealth address derivation for g-pay.
//!
//! Two-key Cryptonote-style scheme adapted for Curve25519:
//!   - spend_key (sk_s) signs releases (or PDA-only release skips this entirely)
//!   - view_key  (sk_v) scans incoming deposits without spend authority
//!
//! See `docs/DESIGN.md` §4.1 for the full math.

#![deny(unsafe_code)]

mod error;
mod keys;
mod scan;
mod stealth;

pub use error::StealthError;
pub use keys::{SpendKey, SpendPublicKey, ViewKey, ViewPublicKey};
pub use scan::{scan_deposit, ScanResult};
pub use stealth::{
    derive_stealth_address, derive_stealth_address_deterministic,
    derive_stealth_address_with_nonce, reconstruct_spend_scalar, StealthAddress,
};

pub const VIEW_TAG_BYTES: usize = 1;
