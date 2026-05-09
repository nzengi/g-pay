# g-pay deployment plan

**Hedef:** 212.64.210.20 üzerinde production stack + Vercel'de dashboard.

## Topoloji

```
Solana devnet/mainnet
        ▲
        │ RPC (Helius/Triton)
        │
┌───────┴────────────────────────────────────────────────────────┐
│ Sunucu  212.64.210.20                                          │
│                                                                │
│  Caddy (TLS, reverse proxy)  ─►  api-gateway:3000              │
│                                                                │
│  Internal docker network:                                      │
│    api-gateway   (Node 22 / Hono)                              │
│    indexer       (Rust binary, RPC subscribe)                  │
│    relayer       (Rust binary, fee payer)                      │
│    oracle        (Rust binary, AML adapter)                    │
│    postgres      (16-alpine, with persistent volume)           │
│    redis         (7-alpine)                                    │
│                                                                │
│  Ports exposed: 80, 443, 22 only                               │
│  Firewall (ufw): allow 22/tcp 80/tcp 443/tcp; deny rest        │
│  fail2ban for SSH                                              │
└────────────────────────────────────────────────────────────────┘

Vercel
  dashboard.gpay.xxx → Next.js 16, NEXT_PUBLIC_API_URL = https://api.gpay.xxx
```

## Adımlar

### 1. Sunucu bootstrap (kullanıcı manual çalıştırır)

```sh
# 1.1 Şifre rotate (root login disabled to follow)
passwd

# 1.2 Deploy kullanıcısı + SSH key
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
# (lokalden id_ed25519_gpay.pub içeriğini buraya kopyala)
nano /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# 1.3 SSH güvenlik
sed -i 's/^#*PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# 1.4 Firewall + fail2ban
apt update && apt install -y ufw fail2ban
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban
```

### 2. Docker (deploy user olarak)

```sh
# Docker official install script
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
# logout/login
docker compose version  # plugin v2 zaten dahil
```

### 3. Repo'yu sunucuya at

```sh
# Lokalden:
rsync -avz --exclude target --exclude node_modules --exclude .anchor \
      /home/nzengi/Desktop/g-pay/ deploy@212.64.210.20:~/g-pay/
```

### 4. Docker compose stack

`g-pay/deploy/docker-compose.yml` (eklenecek):
- postgres → kalıcı volume `pgdata`
- redis
- api-gateway → multi-stage Node 22 image, env'lerden DB, REDIS, RPC URL
- indexer → multi-stage Rust image, alpine runtime
- relayer → aynı şekilde
- oracle → aynı şekilde
- caddy → port 80/443, otomatik TLS

`docker compose up -d` ile her şey ayağa kalkar.

### 5. Postgres şema

`deploy/migrations/001_init.sql`:
```sql
CREATE TABLE institutions (
  id TEXT PRIMARY KEY,
  api_key_hash TEXT NOT NULL,
  spend_pub BYTEA NOT NULL,
  view_pub BYTEA NOT NULL,
  release_authority BYTEA NOT NULL,
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE slices (
  id BIGSERIAL PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  slice_index BIGINT NOT NULL,
  view_key_kms_ref TEXT NOT NULL,
  spend_pub BYTEA NOT NULL,
  current_pubkey BYTEA,
  balance_lamports BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, slice_index)
);

CREATE TABLE deposits (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  slice_id BIGINT REFERENCES slices(id),
  customer_id TEXT NOT NULL,
  amount_hint BIGINT NOT NULL,
  mint TEXT NOT NULL,
  stealth_pubkey BYTEA NOT NULL,
  ephemeral_r BYTEA NOT NULL,
  view_tag SMALLINT NOT NULL,
  refund_addr BYTEA NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX deposits_state_idx ON deposits(institution_id, state);
CREATE INDEX deposits_view_tag_idx ON deposits(view_tag);

CREATE TABLE attestations (
  deposit_id TEXT NOT NULL REFERENCES deposits(id),
  oracle_pubkey BYTEA NOT NULL,
  verdict TEXT NOT NULL,
  evidence_hash BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (deposit_id, oracle_pubkey)
);
```

Migration tool: `sqlx-cli` (Rust) veya basit `psql -f`.

### 6. Service refactor (server'a göç için minimum)

| Servis | Şimdi | Değişiklik gerekli |
|--------|-------|--------------------|
| api-gateway | in-memory store | Postgres pool + sqlx/Drizzle |
| api-gateway | static demo institution | Postgres'ten yükle |
| api-gateway | localhost log | structured JSON log (pino) |
| indexer | scaffold only | RPC client, getProgramAccounts polling, websocket subscribe |
| relayer | policy katmanı | Solana keypair, signature ekleme, RPC submit |
| oracle | stub | Chainalysis API adapter (env'den key) |

### 7. Vercel deploy

```sh
# apps/dashboard içinde:
npx vercel link
# Project Settings → Environment Variables:
#   NEXT_PUBLIC_API_URL = https://api.gpay.xxx (sunucu)
npx vercel --prod
```

Build settings:
- Framework: Next.js (auto-detect)
- Root directory: `apps/dashboard`
- Build command: `npm run build`
- Output: `.next`

### 8. CI/CD (sonra)

- GitHub Actions workflow
- Lint + typecheck + tüm test suite (Rust + TS)
- Docker image build + push to GHCR
- SSH ile sunucuda `docker compose pull && up -d`
- Vercel deploy preview her PR'da, prod main'e merge'de

### 9. İzleme (sonra)

- Caddy access log → Loki
- Service metrics → Prometheus + Grafana
- Postgres backup → günlük pg_dump cron + S3 (BackBlaze B2)

## Checklist (sırayla)

- [ ] Şifre rotate edildi
- [ ] SSH key kuruldu, root login disabled
- [ ] Firewall + fail2ban aktif
- [ ] Docker + Compose plugin yüklendi
- [ ] Repo rsync ile geldi
- [ ] `.env` dosyaları üretildi (Postgres password, Helius API key, AML key)
- [ ] `docker compose up -d` ile stack ayakta
- [ ] Postgres migration çalıştı, demo institution insert edildi
- [ ] `curl https://api.gpay.xxx/healthz` 200
- [ ] Dashboard Vercel'de live
- [ ] End-to-end: dashboard → gateway → indexer → vault → release
