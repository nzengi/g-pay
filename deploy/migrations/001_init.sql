CREATE TABLE IF NOT EXISTS institutions (
  id              TEXT PRIMARY KEY,
  api_key         TEXT NOT NULL,
  spend_pub       BYTEA NOT NULL,
  view_pub        BYTEA NOT NULL,
  release_authority BYTEA NOT NULL,
  webhook_url     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS institutions_api_key_idx ON institutions (api_key);

CREATE TABLE IF NOT EXISTS deposits (
  id                    TEXT PRIMARY KEY,
  institution_id        TEXT NOT NULL REFERENCES institutions(id),
  customer_id           TEXT NOT NULL,
  amount_hint           NUMERIC(40, 0) NOT NULL,
  mint                  TEXT NOT NULL,
  stealth_pubkey        BYTEA NOT NULL,
  ephemeral_r           BYTEA NOT NULL,
  view_tag              SMALLINT NOT NULL,
  refund_addr           BYTEA NOT NULL,
  state                 TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at            TIMESTAMPTZ NOT NULL,
  on_chain_address      TEXT,
  on_chain_amount       NUMERIC(40, 0),
  on_chain_state        TEXT,
  on_chain_observed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS deposits_inst_state_idx ON deposits (institution_id, state, created_at DESC);
CREATE INDEX IF NOT EXISTS deposits_stealth_idx ON deposits (stealth_pubkey);

INSERT INTO institutions (id, api_key, spend_pub, view_pub, release_authority)
VALUES (
  'demo_bank',
  'g-p_demo_h6kj9d8s7g6f5d4',
  decode('616e237719716e25ead63d831f9117f79b5aa05af8be30ff0eddb3dc43e8bdcf', 'hex'),
  decode('3e97bbe3dad77cdbab3b9d7a5af963868b2ee668470874b566dad4a32076c98b', 'hex'),
  decode('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
)
ON CONFLICT (id) DO NOTHING;
