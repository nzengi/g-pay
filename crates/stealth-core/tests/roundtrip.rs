use curve25519_dalek::{edwards::EdwardsPoint, scalar::Scalar};
use rand::rngs::OsRng;
use stealth_core::{
    derive_stealth_address_with_nonce, reconstruct_spend_scalar, scan_deposit, SpendKey, ViewKey,
};

#[test]
fn sender_to_recipient_roundtrip_scans_and_spends() {
    let mut rng = OsRng;
    let spend = SpendKey::random(&mut rng);
    let view = ViewKey::random(&mut rng);
    let spend_pub = spend.public();
    let view_pub = view.public();

    let nonce = 42u64;
    let addr = derive_stealth_address_with_nonce(&spend_pub, &view_pub, nonce, &mut rng);

    let scan = scan_deposit(
        &view,
        &spend_pub,
        &addr.stealth_pubkey,
        &addr.ephemeral_r,
        addr.view_tag,
        nonce,
    )
    .unwrap();
    assert!(scan.matched, "view-key scan must find this deposit");
    assert_eq!(scan.stealth_pubkey, addr.stealth_pubkey);

    let recovered_scalar =
        reconstruct_spend_scalar(&spend, &view, &addr.ephemeral_r, nonce).unwrap();
    let recovered_pub = EdwardsPoint::mul_base(&recovered_scalar)
        .compress()
        .to_bytes();
    assert_eq!(
        recovered_pub, addr.stealth_pubkey,
        "spend-key reconstruction must yield the on-chain stealth pubkey"
    );
    let _ = Scalar::from_bytes_mod_order(recovered_scalar.to_bytes());
}

#[test]
fn wrong_view_key_does_not_match() {
    let mut rng = OsRng;
    let spend = SpendKey::random(&mut rng);
    let view = ViewKey::random(&mut rng);
    let other_view = ViewKey::random(&mut rng);
    let spend_pub = spend.public();

    let addr = derive_stealth_address_with_nonce(&spend_pub, &view.public(), 0, &mut rng);

    let scan = scan_deposit(
        &other_view,
        &spend_pub,
        &addr.stealth_pubkey,
        &addr.ephemeral_r,
        addr.view_tag,
        0,
    )
    .unwrap();
    assert!(!scan.matched);
}

#[test]
fn nonce_uniqueness_yields_distinct_pubkeys() {
    let mut rng = OsRng;
    let spend = SpendKey::random(&mut rng);
    let view = ViewKey::random(&mut rng);

    let addr_a = derive_stealth_address_with_nonce(&spend.public(), &view.public(), 1, &mut rng);
    let addr_b = derive_stealth_address_with_nonce(&spend.public(), &view.public(), 2, &mut rng);
    assert_ne!(addr_a.stealth_pubkey, addr_b.stealth_pubkey);
    assert_ne!(addr_a.ephemeral_r, addr_b.ephemeral_r);
}
