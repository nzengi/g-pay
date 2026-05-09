use std::{fs, path::Path};

use anchor_lang::prelude::Pubkey;
use anyhow::{anyhow, Context, Result};
use serde::Deserialize;
use stealth_core::{SpendPublicKey, ViewKey};

use crate::SliceCredentials;
use crate::SliceId;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub rpc_url: String,
    pub gateway_url: String,
    pub gateway_internal_secret: String,
    pub program_id: String,
    pub scan_interval_ms: u64,
    pub slices_file: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SliceFile {
    pub slices: Vec<SliceEntry>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SliceEntry {
    pub slice_id: u64,
    pub view_priv_hex: String,
    pub spend_pub_hex: String,
    #[serde(default)]
    pub nonce: u64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            rpc_url: std::env::var("GPAY_RPC_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:8899".into()),
            gateway_url: std::env::var("GPAY_GATEWAY_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3000".into()),
            gateway_internal_secret: std::env::var("GPAY_INTERNAL_SECRET")
                .unwrap_or_else(|_| "dev-internal-secret-rotate".into()),
            program_id: std::env::var("GPAY_PROGRAM_ID")
                .unwrap_or_else(|_| quarantine_vault::id().to_string()),
            scan_interval_ms: std::env::var("GPAY_SCAN_INTERVAL_MS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(5_000),
            slices_file: std::env::var("GPAY_SLICES_FILE")
                .unwrap_or_else(|_| "config/slices.json".into()),
        })
    }

    pub fn program_pubkey(&self) -> Result<Pubkey> {
        self.program_id
            .parse()
            .with_context(|| format!("invalid program id: {}", self.program_id))
    }
}

pub fn load_slices(path: impl AsRef<Path>) -> Result<Vec<SliceCredentials>> {
    let path = path.as_ref();
    let body =
        fs::read_to_string(path).with_context(|| format!("read slices file {}", path.display()))?;
    let parsed: SliceFile = serde_json::from_str(&body)
        .with_context(|| format!("parse slices file {}", path.display()))?;
    parsed
        .slices
        .into_iter()
        .map(|e| {
            let view_priv: [u8; 32] = decode_hex32(&e.view_priv_hex)
                .with_context(|| format!("slice {}: view_priv_hex", e.slice_id))?;
            let spend_pub: [u8; 32] = decode_hex32(&e.spend_pub_hex)
                .with_context(|| format!("slice {}: spend_pub_hex", e.slice_id))?;
            let view_key =
                ViewKey::from_bytes(&view_priv).map_err(|e| anyhow!("view scalar: {e}"))?;
            let spend_pub = SpendPublicKey::from_bytes(&spend_pub)
                .map_err(|e| anyhow!("spend pub point: {e}"))?;
            Ok(SliceCredentials {
                slice_id: SliceId(e.slice_id),
                view_key,
                spend_pub,
                nonce: e.nonce,
            })
        })
        .collect()
}

fn decode_hex32(s: &str) -> Result<[u8; 32]> {
    let v = hex::decode(s).context("hex decode")?;
    if v.len() != 32 {
        return Err(anyhow!("expected 32 bytes, got {}", v.len()));
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&v);
    Ok(out)
}
