use std::collections::HashMap;

use crate::billing::{BillingLedger, FeeQuote};
use crate::error::RelayerError;
use crate::rate_limit::TokenBucket;

/// Per-institution policy: rate limits, fee schedule, optional monthly cap.
pub struct InstitutionPolicy {
    pub bucket: TokenBucket,
    pub fee: FeeQuote,
    pub monthly_cap_micro_usdc: Option<u64>,
    pub suspended: bool,
}

impl InstitutionPolicy {
    pub fn new(bucket: TokenBucket, fee: FeeQuote) -> Self {
        Self {
            bucket,
            fee,
            monthly_cap_micro_usdc: None,
            suspended: false,
        }
    }

    pub fn with_monthly_cap(mut self, cap_micro_usdc: u64) -> Self {
        self.monthly_cap_micro_usdc = Some(cap_micro_usdc);
        self
    }
}

#[derive(Debug, PartialEq, Eq)]
pub struct SubmissionDecision {
    pub fee: FeeQuote,
    pub bucket_remaining: u64,
}

#[derive(Default)]
pub struct Relayer {
    policies: HashMap<String, InstitutionPolicy>,
    ledgers: HashMap<String, BillingLedger>,
}

impl Relayer {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, institution_id: impl Into<String>, policy: InstitutionPolicy) {
        let id = institution_id.into();
        self.policies.insert(id.clone(), policy);
        self.ledgers.entry(id).or_default();
    }

    pub fn suspend(&mut self, institution_id: &str) {
        if let Some(p) = self.policies.get_mut(institution_id) {
            p.suspended = true;
        }
    }

    pub fn ledger(&self, institution_id: &str) -> Option<&BillingLedger> {
        self.ledgers.get(institution_id)
    }

    /// Admission check: rate limit + billing cap. If accepted, accrues the fee.
    /// In production this is followed by signing + RPC submit.
    pub fn admit(&mut self, institution_id: &str) -> Result<SubmissionDecision, RelayerError> {
        let policy = self
            .policies
            .get_mut(institution_id)
            .ok_or(RelayerError::UnknownInstitution)?;

        if policy.suspended {
            return Err(RelayerError::Suspended);
        }

        let ledger = self
            .ledgers
            .get_mut(institution_id)
            .expect("ledger initialised in register()");

        if let Some(cap) = policy.monthly_cap_micro_usdc {
            if ledger
                .total_micro_usdc()
                .saturating_add(policy.fee.micro_usdc)
                > cap
            {
                return Err(RelayerError::FeeCapExceeded);
            }
        }

        if !policy.bucket.try_consume(1) {
            return Err(RelayerError::RateLimited);
        }

        ledger.accrue(policy.fee);

        Ok(SubmissionDecision {
            fee: policy.fee,
            bucket_remaining: policy.bucket.available() as u64,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> Relayer {
        let mut r = Relayer::new();
        r.register(
            "bank_x",
            InstitutionPolicy::new(TokenBucket::new(3, 1.0), FeeQuote::new(50_000)),
        );
        r
    }

    #[test]
    fn unknown_institution_rejected() {
        let mut r = Relayer::new();
        assert_eq!(r.admit("nope"), Err(RelayerError::UnknownInstitution));
    }

    #[test]
    fn admits_until_bucket_empty() {
        let mut r = fixture();
        for _ in 0..3 {
            assert!(r.admit("bank_x").is_ok());
        }
        assert_eq!(r.admit("bank_x"), Err(RelayerError::RateLimited));
    }

    #[test]
    fn fee_accrues_per_admit() {
        let mut r = fixture();
        r.admit("bank_x").unwrap();
        r.admit("bank_x").unwrap();
        let ledger = r.ledger("bank_x").unwrap();
        assert_eq!(ledger.tx_count(), 2);
        assert_eq!(ledger.total_micro_usdc(), 100_000);
    }

    #[test]
    fn monthly_cap_enforced() {
        let mut r = Relayer::new();
        r.register(
            "bank_y",
            InstitutionPolicy::new(TokenBucket::new(10, 1.0), FeeQuote::new(50_000))
                .with_monthly_cap(100_000),
        );
        assert!(r.admit("bank_y").is_ok());
        assert!(r.admit("bank_y").is_ok());
        assert_eq!(r.admit("bank_y"), Err(RelayerError::FeeCapExceeded));
    }

    #[test]
    fn suspended_institution_blocked() {
        let mut r = fixture();
        r.suspend("bank_x");
        assert_eq!(r.admit("bank_x"), Err(RelayerError::Suspended));
    }
}
