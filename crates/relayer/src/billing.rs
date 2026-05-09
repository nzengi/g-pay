/// Per-transaction fee charged to the institution, denominated in micro-USDC.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct FeeQuote {
    pub micro_usdc: u64,
}

impl FeeQuote {
    pub const fn new(micro_usdc: u64) -> Self {
        Self { micro_usdc }
    }
}

/// In-memory ledger of accrued fees for the current settlement period.
/// Persistence (Postgres) lives outside this crate.
#[derive(Default)]
pub struct BillingLedger {
    accrued_micro_usdc: u64,
    tx_count: u64,
}

impl BillingLedger {
    pub fn accrue(&mut self, fee: FeeQuote) {
        self.accrued_micro_usdc = self.accrued_micro_usdc.saturating_add(fee.micro_usdc);
        self.tx_count = self.tx_count.saturating_add(1);
    }

    pub fn total_micro_usdc(&self) -> u64 {
        self.accrued_micro_usdc
    }

    pub fn tx_count(&self) -> u64 {
        self.tx_count
    }

    pub fn reset(&mut self) {
        self.accrued_micro_usdc = 0;
        self.tx_count = 0;
    }
}
