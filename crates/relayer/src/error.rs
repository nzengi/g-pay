use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum RelayerError {
    #[error("institution not registered")]
    UnknownInstitution,

    #[error("rate limit exceeded for institution")]
    RateLimited,

    #[error("institution suspended")]
    Suspended,

    #[error("monthly fee cap exceeded")]
    FeeCapExceeded,
}
