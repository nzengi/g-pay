use std::time::Duration;

use anyhow::{Context, Result};
use gpay_indexer::config::{self, Config};
use gpay_indexer::rpc_scan::scan_program_accounts;
use gpay_indexer::webhook::notify_match;
use gpay_indexer::Indexer;
use solana_client::rpc_client::RpcClient;

fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info,gpay_indexer=debug")),
        )
        .init();

    let cfg = Config::from_env().context("loading config from env")?;
    let program_id = cfg.program_pubkey()?;
    let slices = config::load_slices(&cfg.slices_file)
        .with_context(|| format!("loading slices from {}", cfg.slices_file))?;

    let mut indexer = Indexer::new();
    for s in slices {
        indexer.register(s);
    }

    let rpc = RpcClient::new(cfg.rpc_url.clone());
    let http = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;

    tracing::info!(
        rpc = %cfg.rpc_url,
        gateway = %cfg.gateway_url,
        program = %program_id,
        slices = indexer.registered(),
        interval_ms = cfg.scan_interval_ms,
        "indexer started"
    );

    loop {
        match scan_program_accounts(&rpc, &program_id, &indexer) {
            Ok(matches) => {
                if matches.is_empty() {
                    tracing::debug!("scan: no matches this round");
                } else {
                    tracing::info!(matched = matches.len(), "scan: dispatching matches");
                    for m in matches {
                        if let Err(e) =
                            notify_match(&http, &cfg.gateway_url, &cfg.gateway_internal_secret, &m)
                        {
                            tracing::warn!(slice = m.slice_id.0, error = %e, "webhook failed");
                        }
                    }
                }
            }
            Err(e) => {
                tracing::warn!(error = %e, "scan pass failed");
            }
        }
        std::thread::sleep(Duration::from_millis(cfg.scan_interval_ms));
    }
}
