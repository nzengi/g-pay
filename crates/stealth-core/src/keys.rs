use curve25519_dalek::{edwards::EdwardsPoint, scalar::Scalar};
use rand::{CryptoRng, RngCore};
use zeroize::Zeroize;

use crate::error::StealthError;

#[derive(Clone, Zeroize)]
#[zeroize(drop)]
pub struct SpendKey(pub(crate) Scalar);

#[derive(Clone, Copy)]
pub struct SpendPublicKey(pub(crate) EdwardsPoint);

#[derive(Clone, Zeroize)]
#[zeroize(drop)]
pub struct ViewKey(pub(crate) Scalar);

#[derive(Clone, Copy)]
pub struct ViewPublicKey(pub(crate) EdwardsPoint);

impl SpendKey {
    pub fn random<R: RngCore + CryptoRng>(rng: &mut R) -> Self {
        let mut bytes = [0u8; 64];
        rng.fill_bytes(&mut bytes);
        SpendKey(Scalar::from_bytes_mod_order_wide(&bytes))
    }

    pub fn from_bytes(bytes: &[u8; 32]) -> Result<Self, StealthError> {
        Option::<Scalar>::from(Scalar::from_canonical_bytes(*bytes))
            .map(SpendKey)
            .ok_or(StealthError::InvalidScalar)
    }

    pub fn to_bytes(&self) -> [u8; 32] {
        self.0.to_bytes()
    }

    pub fn public(&self) -> SpendPublicKey {
        SpendPublicKey(EdwardsPoint::mul_base(&self.0))
    }
}

impl ViewKey {
    pub fn random<R: RngCore + CryptoRng>(rng: &mut R) -> Self {
        let mut bytes = [0u8; 64];
        rng.fill_bytes(&mut bytes);
        ViewKey(Scalar::from_bytes_mod_order_wide(&bytes))
    }

    pub fn from_bytes(bytes: &[u8; 32]) -> Result<Self, StealthError> {
        Option::<Scalar>::from(Scalar::from_canonical_bytes(*bytes))
            .map(ViewKey)
            .ok_or(StealthError::InvalidScalar)
    }

    pub fn to_bytes(&self) -> [u8; 32] {
        self.0.to_bytes()
    }

    pub fn public(&self) -> ViewPublicKey {
        ViewPublicKey(EdwardsPoint::mul_base(&self.0))
    }
}

impl SpendPublicKey {
    pub fn from_bytes(bytes: &[u8; 32]) -> Result<Self, StealthError> {
        let compressed = curve25519_dalek::edwards::CompressedEdwardsY(*bytes);
        compressed
            .decompress()
            .map(SpendPublicKey)
            .ok_or(StealthError::InvalidPoint)
    }

    pub fn to_bytes(&self) -> [u8; 32] {
        self.0.compress().to_bytes()
    }
}

impl ViewPublicKey {
    pub fn from_bytes(bytes: &[u8; 32]) -> Result<Self, StealthError> {
        let compressed = curve25519_dalek::edwards::CompressedEdwardsY(*bytes);
        compressed
            .decompress()
            .map(ViewPublicKey)
            .ok_or(StealthError::InvalidPoint)
    }

    pub fn to_bytes(&self) -> [u8; 32] {
        self.0.compress().to_bytes()
    }
}
