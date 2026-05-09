use thiserror::Error;

#[derive(Debug, Error)]
pub enum IndexerError {
    #[error("scan failure: {0}")]
    Scan(#[from] stealth_core::StealthError),

    #[error("on-chain account decode failure")]
    Decode,
}
