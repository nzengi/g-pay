use anchor_lang::{AccountDeserialize, Space};
use anyhow::{Context, Result};
use quarantine_vault::state::Deposit;
use solana_account_decoder::UiAccountEncoding;
use solana_client::rpc_client::RpcClient;
use solana_client::rpc_config::{RpcAccountInfoConfig, RpcProgramAccountsConfig};
use solana_client::rpc_filter::RpcFilterType;
use solana_commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;

use crate::Indexer;
use crate::PaymentMatch;

/// Returns Deposit-account-sized matches discovered by the scanner.
pub fn scan_program_accounts(
    rpc: &RpcClient,
    program_id: &Pubkey,
    indexer: &Indexer,
) -> Result<Vec<PaymentMatch>> {
    let deposit_size = 8 + Deposit::INIT_SPACE;

    let config = RpcProgramAccountsConfig {
        filters: Some(vec![RpcFilterType::DataSize(deposit_size as u64)]),
        account_config: RpcAccountInfoConfig {
            encoding: Some(UiAccountEncoding::Base64),
            commitment: Some(CommitmentConfig::confirmed()),
            data_slice: None,
            min_context_slot: None,
        },
        with_context: Some(false),
        sort_results: Some(false),
    };

    #[allow(deprecated)]
    let accounts = rpc
        .get_program_accounts_with_config(program_id, config)
        .with_context(|| format!("getProgramAccounts {program_id}"))?;

    let mut matches = Vec::new();
    for (pubkey, account) in accounts {
        let Ok(deposit) = Deposit::try_deserialize(&mut account.data.as_slice()) else {
            continue;
        };
        if let Some(m) = indexer.scan(pubkey, &deposit)? {
            matches.push(m);
        }
    }
    Ok(matches)
}
