use curve25519_dalek::{edwards::EdwardsPoint, scalar::Scalar};
use rand::{CryptoRng, RngCore};
use sha2::{Digest, Sha512};

use crate::error::StealthError;
use crate::keys::{SpendKey, SpendPublicKey, ViewKey, ViewPublicKey};

const DOMAIN_SHARED: &[u8] = b"g-pay/stealth/shared/v1";
const DOMAIN_OFFSET: &[u8] = b"g-pay/stealth/offset/v1";
const DOMAIN_VIEW_TAG: &[u8] = b"g-pay/stealth/view-tag/v1";

#[derive(Clone, Copy)]
pub struct StealthAddress {
    pub stealth_pubkey: [u8; 32],
    pub ephemeral_r: [u8; 32],
    pub view_tag: u8,
}

pub fn derive_stealth_address<R: RngCore + CryptoRng>(
    spend_pub: &SpendPublicKey,
    view_pub: &ViewPublicKey,
    rng: &mut R,
) -> StealthAddress {
    derive_stealth_address_with_nonce(spend_pub, view_pub, 0, rng)
}

pub fn derive_stealth_address_with_nonce<R: RngCore + CryptoRng>(
    spend_pub: &SpendPublicKey,
    view_pub: &ViewPublicKey,
    nonce: u64,
    rng: &mut R,
) -> StealthAddress {
    let mut r_seed = [0u8; 64];
    rng.fill_bytes(&mut r_seed);
    derive_stealth_address_deterministic(spend_pub, view_pub, &r_seed, nonce)
}

/// Deterministic variant exposed for cross-language test vectors.
/// `r_seed` is a 64-byte uniform sample reduced mod L to obtain the ephemeral scalar.
pub fn derive_stealth_address_deterministic(
    spend_pub: &SpendPublicKey,
    view_pub: &ViewPublicKey,
    r_seed: &[u8; 64],
    nonce: u64,
) -> StealthAddress {
    let r = Scalar::from_bytes_mod_order_wide(r_seed);

    let r_pub = EdwardsPoint::mul_base(&r);
    let shared_point = r * view_pub.0;

    let shared = hash_point(DOMAIN_SHARED, &shared_point);
    let offset = scalar_from_hash(DOMAIN_OFFSET, &shared, nonce);
    let offset_point = EdwardsPoint::mul_base(&offset);
    let stealth_point = spend_pub.0 + offset_point;

    StealthAddress {
        stealth_pubkey: stealth_point.compress().to_bytes(),
        ephemeral_r: r_pub.compress().to_bytes(),
        view_tag: view_tag(&shared),
    }
}

pub fn reconstruct_spend_scalar(
    spend: &SpendKey,
    view: &ViewKey,
    ephemeral_r: &[u8; 32],
    nonce: u64,
) -> Result<Scalar, StealthError> {
    let r_compressed = curve25519_dalek::edwards::CompressedEdwardsY(*ephemeral_r);
    let r_point = r_compressed
        .decompress()
        .ok_or(StealthError::InvalidPoint)?;
    let shared_point = view.0 * r_point;
    let shared = hash_point(DOMAIN_SHARED, &shared_point);
    let offset = scalar_from_hash(DOMAIN_OFFSET, &shared, nonce);
    Ok(spend.0 + offset)
}

pub(crate) fn shared_secret(
    view: &ViewKey,
    ephemeral_r: &[u8; 32],
) -> Result<[u8; 32], StealthError> {
    let r_compressed = curve25519_dalek::edwards::CompressedEdwardsY(*ephemeral_r);
    let r_point = r_compressed
        .decompress()
        .ok_or(StealthError::InvalidPoint)?;
    let shared_point = view.0 * r_point;
    Ok(hash_point(DOMAIN_SHARED, &shared_point))
}

pub(crate) fn derive_for_recipient(
    spend_pub: &SpendPublicKey,
    shared: &[u8; 32],
    nonce: u64,
) -> [u8; 32] {
    let offset = scalar_from_hash(DOMAIN_OFFSET, shared, nonce);
    let offset_point = EdwardsPoint::mul_base(&offset);
    let stealth_point = spend_pub.0 + offset_point;
    stealth_point.compress().to_bytes()
}

pub(crate) fn view_tag(shared: &[u8; 32]) -> u8 {
    let mut hasher = Sha512::new();
    hasher.update(DOMAIN_VIEW_TAG);
    hasher.update(shared);
    let out = hasher.finalize();
    out[0]
}

fn hash_point(domain: &[u8], point: &EdwardsPoint) -> [u8; 32] {
    let mut hasher = Sha512::new();
    hasher.update(domain);
    hasher.update(point.compress().as_bytes());
    let out = hasher.finalize();
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(&out[..32]);
    bytes
}

fn scalar_from_hash(domain: &[u8], shared: &[u8; 32], nonce: u64) -> Scalar {
    let mut hasher = Sha512::new();
    hasher.update(domain);
    hasher.update(shared);
    hasher.update(nonce.to_le_bytes());
    let out = hasher.finalize();
    let mut wide = [0u8; 64];
    wide.copy_from_slice(&out);
    Scalar::from_bytes_mod_order_wide(&wide)
}
