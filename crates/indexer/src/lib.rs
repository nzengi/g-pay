//! Stealth-address indexer for g-pay institutions.

#![deny(unsafe_code)]

pub mod config;
mod error;
pub mod rpc_scan;
pub mod webhook;

use anchor_lang::prelude::Pubkey;
use quarantine_vault::state::{Deposit, DepositState};
use stealth_core::{scan_deposit, SpendPublicKey, ViewKey};

pub use error::IndexerError;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct SliceId(pub u64);

pub struct SliceCredentials {
    pub slice_id: SliceId,
    pub view_key: ViewKey,
    pub spend_pub: SpendPublicKey,
    pub nonce: u64,
}

#[derive(Debug, Clone)]
pub struct PaymentMatch {
    pub slice_id: SliceId,
    pub deposit_pubkey: Pubkey,
    pub stealth_pubkey: Pubkey,
    pub amount: u64,
    pub state: DepositState,
}

#[derive(Default)]
pub struct Indexer {
    slices: Vec<SliceCredentials>,
}

impl Indexer {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, slice: SliceCredentials) {
        self.slices.push(slice);
    }

    pub fn registered(&self) -> usize {
        self.slices.len()
    }

    pub fn scan(
        &self,
        deposit_pubkey: Pubkey,
        deposit: &Deposit,
    ) -> Result<Option<PaymentMatch>, IndexerError> {
        for slice in &self.slices {
            let result = scan_deposit(
                &slice.view_key,
                &slice.spend_pub,
                deposit
                    .stealth_pubkey
                    .as_ref()
                    .try_into()
                    .expect("32 bytes"),
                &deposit.ephemeral_r,
                deposit.view_tag,
                slice.nonce,
            )
            .map_err(IndexerError::Scan)?;

            if result.matched {
                return Ok(Some(PaymentMatch {
                    slice_id: slice.slice_id,
                    deposit_pubkey,
                    stealth_pubkey: deposit.stealth_pubkey,
                    amount: deposit.amount,
                    state: deposit.state,
                }));
            }
        }
        Ok(None)
    }
}
