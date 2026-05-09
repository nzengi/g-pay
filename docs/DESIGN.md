# g-pay — Tasarım Dokümanı

**Versiyon:** 0.1 (draft)
**Tarih:** 2026-05-09
**Kapsam:** Solana üzerinde kurumsal mahremiyet API'si — alıcı ana cüzdanı zincirde görünmez tutmak.

---

## 1. Problem

Mevcut Solana mahremiyet çözümleri (Confidential Balances, GhostWare, Lumenless) **miktar gizler, adres gizlemez**. Kurumsal kullanım senaryosunda asıl risk şudur:

> "X bankası ödeme adresini paylaşır. Müşteri ödeme yapar. 6 ay sonra ödeyen adres OFAC listesine girer. Bankanın hazinesi şu an enfekte fonla bağlantılı. Dava."

Çözmemiz gereken iki bağımsız problem:

1. **Adres mahremiyeti** — Banka'nın asıl hazinesi zincirde tek bir entity olarak görünmemeli; chain analysis ile cluster'lanamamalı.
2. **AML kontrol noktası** — Kirli fon hazineye DOKUNMADAN reddedilmeli; sadece "geç tespit + sweep yok" yetersiz, çünkü retroaktif sanksiyon var.

ZK tabanlı çözümler bu iki problemi çözmek için ya pahalı (privacy pool setup + circuit) ya da yanlış problemi çözüyor (Confidential Balances → miktar).

## 2. Çözüm: 3 Solana primitifinin birleşimi

| Primitif | Görevi | Solana'da daha önce yapılmış mı? |
|----------|--------|----------------------------------|
| **Ed25519 Stealth Addresses** | Her ödeme için yeni alıcı adresi türet, ana adresle on-chain bağ yok | Hayır (akademik var, prod implementasyon yok) |
| **Quarantine Vault** | Ödeme önce escrow'da bekler, AML attestation sonrası serbest | Yaygın değil |
| **Hyperscaled Treasury** | Tek "ana cüzdan" yok; binlerce stealth address üzerinde dağıtık bakiye | Solana'da hiç yok (Bitcoin UTXO best practice'i) |

Hiçbir bileşende ZK kullanılmıyor. Hepsi mevcut Solana primitifleriyle inşa edilebilir.

## 3. Yüksek Seviye Mimari

```
┌────────────────────────────────────────────────────────────────────┐
│                        KURUMSAL MÜŞTERİ (Banka)                    │
│  HSM/KMS:  spend_key (S),  view_key (V),  refund_key               │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ POST /v1/receiving-address
                   │ { customer_id, amount_hint, currency, refund_addr_template }
                   ▼
┌────────────────────────────────────────────────────────────────────┐
│                         G-PAY API GATEWAY                          │
│  - Auth (signed request + API key)                                 │
│  - Stealth address derivation (sender side: emulated for caller)   │
│  - Rate limiting, audit log                                        │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ ephemeral pubkey P, view_tag, ephemeral_R
                   ▼
              [ Ödeyen müşteriye verilir ]
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────┐
│                  ON-CHAIN: QUARANTINE VAULT (Anchor)               │
│                                                                    │
│  deposit(P, R, refund_addr, expire_at)                             │
│    └─> SOL/USDC kilitlenir, vault PDA'da escrow                    │
│                                                                    │
│  attest(deposit_id, status, oracle_sig)                            │
│    └─> Oracle imzalı attestation kaydedilir                        │
│                                                                    │
│  release(deposit_id, target_stealth_addr)  [APPROVE sonrası]       │
│    └─> Hazine slice'ına gider                                      │
│                                                                    │
│  refund(deposit_id)  [REJECT veya EXPIRE]                          │
│    └─> Sender'a geri gönderilir                                    │
└──────┬─────────────────────────────────────────────────┬───────────┘
       │                                                 │
       │                                                 │
       ▼                                                 ▼
┌──────────────────────┐                    ┌──────────────────────────┐
│   AML ORACLE         │                    │  STEALTH SCAN INDEXER    │
│  - Chainalysis API   │                    │  - Helius webhook + WS   │
│  - TRM Labs API      │                    │  - View key tarama       │
│  - Range API         │                    │  - Match → notify        │
│  - Threshold sig     │                    └──────────┬───────────────┘
│    (multi-source)    │                               │
└──────────┬───────────┘                               │
           │ on-chain attest                           │ webhook
           ▼                                           ▼
                              ┌──────────────────────────┐
                              │   KURUMSAL MÜŞTERİ        │
                              │   - Webhook alır          │
                              │   - Internal ledger update│
                              │   - Spend doğrudan        │
                              │     stealth slice'tan     │
                              └──────────────────────────┘

       Tüm SOL fee'leri:  RELAYER  pays.  Settle: USDC monthly.
```

## 4. Bileşen Detayları

### 4.1 Ed25519 Stealth Address Şeması

**Hedef:** Sender, alıcının uzun-ömürlü ana anahtarına bağlanamayacak yeni bir Solana adresi türetir; alıcı bunları view_key ile tarayıp spend_key ile harcayabilir.

**Solana'ya özgü zorluk:** Ed25519 anahtar üretiminde "clamping" var (private scalar'ın belirli bitleri sabitlenir). Naif Monero-style stealth address (P = A + H(rV)·G) Ed25519'da private key reconstruction'ı bozar çünkü `(a + H(rV)) mod L` clamped form'da değildir → ortaya çıkan scalar Solana imzalama yolunda kullanılamaz.

**Çözüm:** İki anahtarlı şema (Monero / Cryptonote v2 mantığı):

```
spend_key:    sk_s ∈ [0, L),  Sk_s = sk_s · G   (uzun ömürlü, sadece HSM'de)
view_key:     sk_v ∈ [0, L),  Sk_v = sk_v · G   (uzun ömürlü, indexer'da)

Sender adımları (banka API'si üzerinden hesaplanır):
  1. r ← rastgele [1, L)
  2. R = r · G                              (ephemeral pubkey, deposit'te yayınlanır)
  3. shared = sk_to_uniform(r · Sk_v)       (Ristretto255 alt-grup üzerinde hash)
  4. ephemeral_priv_offset h = H(shared || nonce)  mod L
  5. P_offset = h · G
  6. P = Sk_s + P_offset                    (alıcının stealth pubkey'i)
  7. view_tag = H(shared)[0..1]             (1 byte, hızlı negative-match)

Recipient (view) tarama:
  for each on-chain deposit (R, view_tag_chain):
    shared' = sk_to_uniform(sk_v · R)
    if H(shared')[0..1] == view_tag_chain:
      h' = H(shared' || nonce) mod L
      P' = Sk_s + h' · G
      check: P' eşleşiyor mu deposit account'ta
      if yes → eşleşme

Recipient (spend) — sadece HSM:
  expanded_priv = (sk_s + h') mod L
  // Ed25519 imzalama için clamped expanded key kullanılır.
  // EdDSA-Ed25519 yerine Schnorr-on-Curve25519 imzalama yolunu kullanırız
  // (Solana ed25519_program ile uyumlu çünkü Solana imza doğrulaması
  //  prehashed scalar'ı destekliyor — bkz. ed25519_dalek::SigningKey::from_bytes)
```

**Notlar:**
- `sk_to_uniform`: Ristretto255 üzerinden uniform sampling — clamping yan etkilerini eler.
- `view_tag`: Tarama maliyetini azaltır (tüm deposit'ler için tam derivation yapmadan elenebilir).
- `nonce`: Deposit account'ta saklanan public counter; aynı `r`'nin yeniden kullanımına karşı güvenlik.
- Solana üzerinde imzalama: Solana ed25519 native verifier `expanded_priv` ile imzayı kabul eder. Ama bizim PoC'umuz `curve25519-dalek` ile özel imza yolunu deneyecek; alternatif olarak quarantine release işlemini Anchor program'ın PDA imzasıyla yapıyoruz (stealth pubkey'in private key'i hiç çıkarmaya gerek kalmıyor — bkz. 4.3).

**Güvenlik özellikleri:**
- Sender, recipient'in ana pubkey'ini bilmeden P üretemez (öncelikle Sk_v ve Sk_s public ama API'mız bunları doğrudan yayınlamıyor — sadece dönen P, R kullanılıyor).
- Yetki ayrımı: view_key sızdığında attacker bakiyeyi görür ama harcayamaz.
- Spend key sızdığında: hiyerarşik rotation (master key → epoch keys), sadece o epoch'un fonu risk altında.

**Açık R&D:** Ed25519/Ristretto bridge implementasyonunun Solana ed25519 instruction ile uyumlu sign çıktısı verip vermediği. Plan: PoC fazında her iki yolu da test et (özel sign + PDA-only release). Eğer özel sign çalışmazsa **PDA-only release** yolu kullanılır — bu zaten daha temiz çünkü kurumun spend_key'i HİÇ kullanılmıyor, program PDA imzasıyla treasury slice'a aktarım yapılıyor.

### 4.2 Quarantine Vault (Anchor Program)

**Sorumluluk:** Gelen ödemeleri AML attestation gelene kadar tut, sonra release veya refund.

**Account modeli:**

```rust
#[account]
pub struct Vault {
    pub authority: Pubkey,           // protocol authority (multisig)
    pub aml_oracle_set: Vec<Pubkey>, // attestor pubkey'leri
    pub min_attestations: u8,        // m-of-n threshold
    pub paused: bool,
}

#[account]
pub struct Deposit {
    pub bump: u8,
    pub vault: Pubkey,
    pub stealth_pubkey: Pubkey,      // P (alıcının stealth address'i)
    pub ephemeral_R: [u8; 32],       // sender'ın ephemeral pubkey'i
    pub view_tag: u8,                // hızlı tarama için
    pub mint: Pubkey,                // SOL ise system program, USDC ise token mint
    pub amount: u64,
    pub depositor: Pubkey,           // sender (refund hedefi)
    pub refund_addr: Pubkey,         // genellikle depositor, override edilebilir
    pub created_at: i64,
    pub expire_at: i64,              // bu süre dolarsa otomatik refund
    pub state: DepositState,
    pub attestations: Vec<Attestation>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum DepositState {
    Pending,        // yatırıldı, AML bekliyor
    Approved,       // attestations >= threshold + clean
    Rejected,       // attestations >= threshold + dirty
    Released,       // banka çekti
    Refunded,       // sender'a iade edildi
    Expired,        // süresi doldu, refund gerekiyor
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Attestation {
    pub oracle: Pubkey,
    pub verdict: AmlVerdict,
    pub timestamp: i64,
    pub evidence_hash: [u8; 32],     // off-chain raporun hash'i
}
```

**State machine:**

```
                    deposit()
                       │
                       ▼
                  ┌─────────┐
                  │ Pending │
                  └────┬────┘
            attest(clean)│  attest(dirty)         time > expire_at
                       │            │                    │
              m-of-n   │   m-of-n   │                    │
                       ▼            ▼                    ▼
                 ┌──────────┐  ┌──────────┐         ┌─────────┐
                 │ Approved │  │ Rejected │         │ Expired │
                 └────┬─────┘  └────┬─────┘         └────┬────┘
            release()│         refund()│              refund()│
                     ▼              ▼                       ▼
              ┌──────────┐    ┌──────────┐
              │ Released │    │ Refunded │
              └──────────┘    └──────────┘
```

**Instruction'lar:**

- `initialize_vault(authority, oracle_set, threshold)`
- `deposit(stealth_pubkey, R, view_tag, mint, amount, refund_addr, expire_seconds)`
- `attest(deposit_id, verdict, evidence_hash)` — sadece oracle_set üyesi imzalayabilir
- `release(deposit_id, target_stealth_addr)` — Approved → Released, fonu hedefe gönder. Authority: depositor değil — kurum tarafından (kurum imzası + view key signature ile)
- `refund(deposit_id)` — Rejected veya Expired → Refunded. Authority: depositor veya kurum.

**Kritik:** `release` çağrısında hedef adres BAŞKA bir stealth address (kurum tarafından önceden derive edilmiş). Yani `Pending` PDA → `target_stealth` arası transfer var ama hiçbiri "ana cüzdan" değil; ikisi de tek-kullanımlık.

### 4.3 Hyperscaled Treasury

**Felsefe:** Bitcoin UTXO best practice'i — her receive yeni adres, hiç consolidation yok. Solana account modelinde herkes single-account düşünür; bu konformizmi kıralım.

**Yapı:**
- Kurum, master_seed → HKDF ile **slice key'leri** türetir: `slice_key_i = HKDF(master_seed, "slice", i)`
- Her `slice_key_i`'den (sk_s_i, sk_v_i) çifti üretilir.
- API üzerinden alınan her ödeme, FARKLI bir slice'a release edilir.
- Off-chain accounting (Postgres) `slice_id → balance` mapping tutar; kurumsal UI aggregate gösterir.

**Spend pattern'i:**
- Kurum bir tedarikçiye ödeme yapacaksa: internal accounting "slice #4321'de 50K USDC var, oradan 50K çek" der.
- Solana tx: `slice_4321 → vendor_addr`. On-chain'de bu izole görünür; chain analysis "slice_4321" ile başka adresleri cluster yapamaz çünkü:
  1. slice'lar farklı stealth address'ler, ortak bir derive seed yok zincirde.
  2. slice arası transfer hiç olmuyor.
  3. fee payer = relayer (kurumsal değil).

**Coin selection:**
- En basit: tek bir slice'tan tek seferde ödeme (tek input, tek output) — minimum link.
- Alternatif: split (ödeme < tek slice) → birden çok slice'tan combine. Bu ANTI-pattern: chain analysis için bunu yapma.
- Kural: ÖDEME MİKTARINI ÖNCEDEN BİLEN slice yarat (yani receiving sırasında slice bakiyesini ödeme paternine göre planla).

**Internal ledger:**

```
Postgres tables:
  institution(id, master_seed_kms_ref, ...)
  slice(id, institution_id, slice_index, sk_v_kms_ref, current_pubkey, balance, created_at)
  slice_history(slice_id, tx_sig, delta, new_balance, timestamp, kind)
  payment(id, slice_id, customer_id, amount, status, deposit_id)
```

**Recovery:** master_seed → HKDF ile tüm slice'lar yeniden türetilebilir. Postgres yedekten kaybolursa bile on-chain'den slice bakiyesi recover edilir (view_key ile tara).

### 4.4 AML Oracle

**Mimari:**
- N adet attestor (başlangıçta 3): Chainalysis adapter, TRM adapter, Range adapter.
- Her attestor: deposit gözlemler → kendi API'sine sorar → on-chain `attest()` çağırır.
- Threshold: m-of-n (örn. 2-of-3) — `Pending` → `Approved` veya `Rejected`.

**Saldırı modeli:**
- Bir attestor compromised → m=2 ile bypass edilemez (en az 2 imza gerek).
- Tüm attestor'lar offline → deposit `Expired` olur, refund edilir (failsafe).
- Attestor yanlış karar → evidence_hash on-chain; off-chain dispute süreci.

**Attestor seçimi:** İlk versiyonda bu attestor'lar hepsi BİZİM altyapımızda çalışıyor (sadece API kaynağı farklı). V2'de partner kurumlar (örn. Ramp Network, Fireblocks) operator olabilir.

**Evidence hash:** Off-chain rapor (JSON: kaynak adres skoru, transaction graph, sanctions match) IPFS'e atılır. Hash on-chain'de saklanır. Audit trail için.

### 4.5 Relayer

**Sorumluluk:** Tüm transaction'ların fee'sini SOL ile öder; kurumsal müşteri hiç SOL tutmak zorunda kalmaz.

**Akış:**
1. API gateway'den / SDK'dan signed transaction template gelir (kurumsal imza + payload).
2. Relayer fee payer slot'una kendi pubkey'ini ekler.
3. Solana RPC'ye submit eder.
4. Tx success → relayer DB'sinde "X kuruluş, Y SOL yaktı, Z USDC fatura"

**Fee modeli:**
- Sabit ücret: tx başına $0.05 USDC equivalent (compute + relayer kar marjı)
- Aylık settlement: kurumsal Stripe-benzeri fatura

**DDoS koruması:**
- API key başına rate limit (örn. 100 tx/dakika)
- Anomalous pattern → otomatik suspend + manual review

**Multi-relayer:** V1 tek relayer; V2'de coğrafi olarak dağıtık (latency için).

### 4.6 API Gateway

**Endpoint'ler (V1):**

```
POST /v1/receiving-address
  body: { institution_id, customer_id, amount_hint, mint, expire_seconds, refund_addr }
  returns: { deposit_pda, stealth_pubkey, ephemeral_R, view_tag, expires_at }

GET /v1/payment-status/:deposit_id
  returns: { state, amount, attestations, can_release }

POST /v1/release
  body: { deposit_id, target_slice_id }
  signed_by: institution authority
  returns: { tx_sig, target_pubkey }

POST /v1/refund
  body: { deposit_id }
  signed_by: institution authority
  returns: { tx_sig }

GET /v1/treasury/balance
  returns: { aggregate_balance_per_mint, slice_count }

POST /v1/treasury/spend
  body: { target_addr, amount, mint }
  signed_by: institution authority
  returns: { tx_sig, slice_used }

POST /v1/webhook-config
  body: { url, events[] }
```

**Auth:**
- Her request: `X-API-Key` header + Ed25519 signature over (timestamp + body hash).
- Kurumsal pubkey API key registration sırasında verilir.

**Rate limiting:** Stripe pattern — 100 RPS default, billed plans daha yüksek.

## 5. Veri Akışı (Tipik Ödeme)

```
Müşteri → Kurum: "100 USDC ödemek istiyorum"
Kurum → API gateway: createReceivingAddress({customer_id: 'C-1234', amount: 100, mint: USDC})
API → Anchor: deposit account hazırla (stealth_pubkey hesaplandı)
API → Kurum: { stealth_pubkey: P, expires_in: 3600s }
Kurum → Müşteri: "P adresine 100 USDC gönder"
Müşteri → Solana: SPL transfer 100 USDC → P
Indexer (view_key ile tarayan): P'de yeni deposit → DB'ye yaz, kuruma webhook
AML attestor #1 (Chainalysis): tx incele → clean → attest()
AML attestor #2 (TRM): tx incele → clean → attest()
[2-of-3 threshold dolduğu an Anchor program state'i Approved'a alır]
Kurum: release(deposit_id, slice_4321_pubkey) çağır
Anchor: Pending PDA → slice_4321 transfer
slice_4321 internal ledger'da +100 USDC
Kurum hesabında aggregate +100 USDC görünür
```

**Kötü senaryo:**

```
Müşteri ödemesi → P
Indexer: deposit detected
AML attestor: dirty (sanctions match)
Anchor: state Rejected
Kurum: refund(deposit_id) çağır
Anchor: P → original sender geri
Kurum hazinesi HİÇ dokunulmamış olarak kalır
```

## 6. Threat Model

| Tehdit | Etki | Mitigation |
|--------|------|------------|
| view_key sızıntısı | Saldırgan kurum bakiyelerini görür | HSM zorunlu; epoch'lu rotation; spend key ayrı |
| spend_key sızıntısı | Saldırgan o slice'ı boşaltır | Per-slice key türetme → blast radius minimal; kurum spend = on-chain MFA (multisig + relayer) |
| AML oracle compromise (1 attestor) | Yanlış attestation | m-of-n threshold; evidence_hash audit trail |
| AML oracle compromise (m attestor) | Kirli ödeme approve olur | V2: çapraz partner attestor'lar; v1: kabul edilen risk |
| Relayer compromise | Censorship, fee theft | Multi-relayer V2; rate limit + monitoring |
| Anchor program bug | Fund loss / theft | OtterSec / Sec3 audit; bug bounty; pause functionality |
| Chain analysis kümeleme | Privacy breach | Hyperscaled (no-consolidation) + relayer fee payer + per-payment slice |
| Replay attack | Duplicate deposit | nonce per stealth_pubkey; deposit PDA seed includes ephemeral_R |
| Front-running on release | MEV theft? | Release destination = stealth, kimse predict edemez (kurumun view_key'i lazım) |
| Sender enforcement (sender'in adresinin gerçekten kaydedildiğini garantilemek) | Yanlış refund_addr → fund stuck | deposit hayatta kalan bakiye için on-chain `refund_addr` zorunlu; kurum fallback |

**Compliance riski:**
- Regülatör yargısı: bu sistem "money transmitter" mi? Kurumsal müşteri kendi KYC'sini yapıyor; biz altyapı sağlıyoruz.
- Travel Rule: $1000+ transfer'lerde sender/receiver bilgisi → kurumsal ledger'da, on-chain'de evidence_hash referansı.
- OFAC: AML attestor zincirinden geçmeyen fon hazineye dokunmaz; reject path ile temizlik mümkün.

**Kabul edilen riskler:**
- View key altyapımızda → biz "operator-blind" değiliz; KYC'li kurumsal için makul.
- Centralized AML oracle → V2'de decentralize.
- Tek relayer → V2'de multi.

## 7. Performans Bütçesi

- Stealth address derivation: <1ms (Ed25519 scalar mul)
- View key tarama (10K deposit): <100ms (view_tag pre-filter)
- Anchor deposit tx: 1 slot (~400ms confirmation)
- AML attestation latency: 5-30s (Chainalysis API)
- Total: payment → release ortalama 10-60 saniye

## 8. Rent ve Cost Modeli

- Deposit PDA rent: ~0.002 SOL ≈ $0.40 @ $200 SOL
- ATA: ~0.002 SOL
- Tx fee + priority: ~0.000005 SOL (negligible)
- AML API call: $0.10-0.50 (Chainalysis pricing)
- Relayer margin: $0.05

**Tx başına toplam ~$1 — kurumsal için kabul edilebilir** (CEX onboarding/withdraw fee'lerinden ucuz).

## 9. MVP Scope (V1, ~12 hafta)

**Dahil:**
- SOL + USDC desteği (devnet)
- Anchor program: deposit, attest, release, refund
- Ed25519 stealth address SDK (Rust + TS)
- Tek AML adapter (mock + Chainalysis)
- Single relayer
- REST API gateway
- Indexer (Helius webhook)
- Test kurumsal müşteri integration örneği

**Hariç (V2'ye):**
- Token-2022 + Confidential Balances katmanlı kullanım
- Multi-relayer
- Multi-attestor decentralization
- Cross-chain (LayerZero / Wormhole gateway)
- Mobile SDK
- Advanced coin selection / privacy tuning

## 10. Açık R&D Maddeleri

1. **Ed25519 stealth address scalar reconstruction** — Solana ed25519 verifier ile uyumlu mu? Test et. Aksi halde PDA-only release model'ine geç.
2. **View key tarama optimizasyonu** — Helius DAS API ile compressed scan; her tx'te 32-byte derivation pahalı olabilir, view_tag pre-filter ne kadar yeter?
3. **Refund_addr provenance** — Sender'ın refund adresini ödeme öncesi kaydetmesi UX zoru; QR + signed message olabilir.
4. **AML attestor multi-source aggregation** — farklı kaynaklar farklı verdict verirse?
5. **Slice depletion stratejisi** — slice tükendiğinde garbage collect (rent reclaim) ve hard delete.
6. **Treasury aggregate UI** — kurumun "tek cüzdan" hissi için off-chain aggregator UI tasarımı.

## 11. Kütüphane / Bağımlılık Listesi

- `anchor-lang = "1.0.1"`
- `anchor-spl = "1.0.1"` (Token + Token-2022)
- `solana-program = "3.x"`
- `curve25519-dalek = "4.x"` (Ristretto + Ed25519)
- `ed25519-dalek = "2.x"`
- `sha2`, `hkdf`, `rand`, `subtle`
- `helius-sdk` (webhook)
- TypeScript: `@coral-xyz/anchor`, `@solana/web3.js`, `@solana/spl-token`

## 12. Repo Yapısı (Hedef)

```
g-pay/
├── docs/
│   ├── DESIGN.md          (bu dosya)
│   ├── THREAT_MODEL.md
│   └── API.md
├── programs/
│   └── quarantine-vault/  (Anchor)
├── crates/
│   ├── stealth-core/      (Ed25519 stealth address)
│   ├── indexer/
│   ├── relayer/
│   └── oracle-adapter/
├── apps/
│   ├── api-gateway/       (Node.js / Bun)
│   └── admin-dashboard/   (Next.js)
├── sdk/
│   ├── rust/
│   └── typescript/
├── tests/
│   └── integration/
├── Anchor.toml
└── Cargo.toml             (workspace)
```

## 13. Sonraki Adım

PoC sırası:
1. **stealth-core crate** — Ed25519 stealth address derivation + scan + spend reconstruction. Unit testlerle math'i kanıtla.
2. **anchor scaffold** — workspace + boş quarantine-vault programı.
3. **deposit + attest + release** — minimum viable flow.
4. **integration test** — end-to-end devnet test.

Tasarım gözden geçirildikten sonra implementasyona başlanır.
