use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::Context;
use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use gpay_relayer::submit::{cosign_as_fee_payer, decode_tx_b64, send_and_confirm};
use gpay_relayer::{FeeQuote, InstitutionPolicy, Relayer, RelayerError, TokenBucket};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use solana_client::rpc_client::RpcClient;
use solana_keypair::{read_keypair_file, Keypair};
use solana_signer::Signer;
use tower_http::trace::TraceLayer;

#[derive(Clone)]
struct AppState {
    rpc: Arc<RpcClient>,
    fee_payer: Arc<Keypair>,
    relayer: Arc<Mutex<Relayer>>,
}

#[derive(Deserialize)]
struct SubmitBody {
    institution_id: String,
    tx_b64: String,
}

#[derive(Serialize)]
struct SubmitOk {
    institution_id: String,
    signature: String,
    fee_micro_usdc: u64,
    bucket_remaining: u64,
}

#[derive(Serialize)]
struct ApiError {
    error: String,
}

fn err(code: StatusCode, msg: impl Into<String>) -> (StatusCode, Json<ApiError>) {
    (code, Json(ApiError { error: msg.into() }))
}

async fn healthz() -> &'static str {
    "ok"
}

#[derive(Serialize)]
struct ConfigEcho {
    fee_payer: String,
    rpc_url: String,
}

async fn config_echo(State(s): State<AppState>) -> Json<ConfigEcho> {
    Json(ConfigEcho {
        fee_payer: s.fee_payer.pubkey().to_string(),
        rpc_url: s.rpc.url().to_string(),
    })
}

async fn submit(
    State(s): State<AppState>,
    Json(body): Json<SubmitBody>,
) -> Result<Json<SubmitOk>, (StatusCode, Json<ApiError>)> {
    let decision = {
        let mut guard = s.relayer.lock();
        guard.admit(&body.institution_id)
    };
    let decision = match decision {
        Ok(d) => d,
        Err(RelayerError::UnknownInstitution) => {
            return Err(err(StatusCode::NOT_FOUND, "unknown institution"));
        }
        Err(RelayerError::Suspended) => {
            return Err(err(StatusCode::FORBIDDEN, "institution suspended"));
        }
        Err(RelayerError::RateLimited) => {
            return Err(err(StatusCode::TOO_MANY_REQUESTS, "rate limited"));
        }
        Err(RelayerError::FeeCapExceeded) => {
            return Err(err(StatusCode::PAYMENT_REQUIRED, "monthly cap exceeded"));
        }
    };

    let unsigned = decode_tx_b64(&body.tx_b64)
        .map_err(|e| err(StatusCode::BAD_REQUEST, format!("invalid tx_b64: {e}")))?;
    let signed = cosign_as_fee_payer(unsigned, &s.fee_payer)
        .map_err(|e| err(StatusCode::BAD_REQUEST, format!("cosign failed: {e}")))?;
    let sig = send_and_confirm(&s.rpc, &signed)
        .map_err(|e| err(StatusCode::BAD_GATEWAY, format!("rpc submit failed: {e}")))?;

    Ok(Json(SubmitOk {
        institution_id: body.institution_id,
        signature: sig,
        fee_micro_usdc: decision.fee.micro_usdc,
        bucket_remaining: decision.bucket_remaining,
    }))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info,gpay_relayer=debug")),
        )
        .init();

    let rpc_url = std::env::var("GPAY_RPC_URL").unwrap_or_else(|_| "http://127.0.0.1:8899".into());
    let keypair_path = std::env::var("GPAY_RELAYER_KEYPAIR")
        .unwrap_or_else(|_| "config/relayer-keypair.json".into());
    let bind = std::env::var("GPAY_RELAYER_BIND").unwrap_or_else(|_| "127.0.0.1:4000".into());

    let fee_payer = read_keypair_file(&keypair_path)
        .map_err(|e| anyhow::anyhow!("read relayer keypair {keypair_path}: {e}"))?;
    tracing::info!(fee_payer = %fee_payer.pubkey(), "relayer keypair loaded");

    let mut relayer = Relayer::new();
    let demo_id = "demo_bank";
    relayer.register(
        demo_id,
        InstitutionPolicy::new(TokenBucket::new(100, 100.0 / 60.0), FeeQuote::new(50_000))
            .with_monthly_cap(10_000_000),
    );
    tracing::info!(institution = demo_id, "registered demo institution policy");

    let state = AppState {
        rpc: Arc::new(RpcClient::new(rpc_url.clone())),
        fee_payer: Arc::new(fee_payer),
        relayer: Arc::new(Mutex::new(relayer)),
    };

    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/v1/config", get(config_echo))
        .route("/v1/submit", post(submit))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr: SocketAddr = bind
        .parse()
        .with_context(|| format!("invalid bind {bind}"))?;
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("bind {addr}"))?;
    tracing::info!(addr = %addr, rpc = %rpc_url, "gpay-relayer listening");

    axum::serve(listener, app).await?;
    Ok(())
}
