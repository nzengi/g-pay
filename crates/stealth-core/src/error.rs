use thiserror::Error;

#[derive(Debug, Error)]
pub enum StealthError {
    #[error("invalid scalar encoding")]
    InvalidScalar,

    #[error("invalid point encoding")]
    InvalidPoint,

    #[error("view tag mismatch")]
    ViewTagMismatch,

    #[error("derived stealth pubkey mismatch")]
    StealthMismatch,
}
