use anchor_lang::prelude::Pubkey;
use gpay_indexer::{Indexer, SliceCredentials, SliceId};
use quarantine_vault::state::{Deposit, DepositState};
use rand::rngs::OsRng;
use stealth_core::{derive_stealth_address_with_nonce, SpendKey, ViewKey};

fn synth_deposit(stealth_pubkey: [u8; 32], ephemeral_r: [u8; 32], view_tag: u8) -> Deposit {
    Deposit {
        bump: 255,
        vault: Pubkey::new_unique(),
        stealth_pubkey: Pubkey::from(stealth_pubkey),
        ephemeral_r,
        view_tag,
        mint: Pubkey::default(),
        amount: 1_000_000,
        depositor: Pubkey::new_unique(),
        refund_addr: Pubkey::new_unique(),
        release_authority: Pubkey::new_unique(),
        created_at: 0,
        expire_at: 3600,
        state: DepositState::Pending,
        attestations: vec![],
        clean_count: 0,
        dirty_count: 0,
    }
}

#[test]
fn matches_registered_slice() {
    let mut rng = OsRng;
    let nonce = 7u64;

    let spend = SpendKey::random(&mut rng);
    let view = ViewKey::random(&mut rng);
    let spend_pub = spend.public();
    let view_pub = view.public();

    let addr = derive_stealth_address_with_nonce(&spend_pub, &view_pub, nonce, &mut rng);

    let mut idx = Indexer::new();
    idx.register(SliceCredentials {
        slice_id: SliceId(42),
        view_key: view,
        spend_pub,
        nonce,
    });

    let deposit_pk = Pubkey::new_unique();
    let deposit = synth_deposit(addr.stealth_pubkey, addr.ephemeral_r, addr.view_tag);

    let m = idx.scan(deposit_pk, &deposit).unwrap();
    let m = m.expect("indexer must match the registered slice");
    assert_eq!(m.slice_id, SliceId(42));
    assert_eq!(m.deposit_pubkey, deposit_pk);
    assert_eq!(m.amount, 1_000_000);
}

#[test]
fn ignores_deposits_for_unrelated_slices() {
    let mut rng = OsRng;

    let our_view = ViewKey::random(&mut rng);
    let our_spend_pub = SpendKey::random(&mut rng).public();

    let stranger_spend = SpendKey::random(&mut rng);
    let stranger_view = ViewKey::random(&mut rng);
    let stranger_addr = derive_stealth_address_with_nonce(
        &stranger_spend.public(),
        &stranger_view.public(),
        0,
        &mut rng,
    );

    let mut idx = Indexer::new();
    idx.register(SliceCredentials {
        slice_id: SliceId(1),
        view_key: our_view,
        spend_pub: our_spend_pub,
        nonce: 0,
    });

    let deposit = synth_deposit(
        stranger_addr.stealth_pubkey,
        stranger_addr.ephemeral_r,
        stranger_addr.view_tag,
    );

    let m = idx.scan(Pubkey::new_unique(), &deposit).unwrap();
    assert!(m.is_none(), "deposit for stranger must not match our slice");
}

#[test]
fn picks_correct_slice_among_many() {
    let mut rng = OsRng;

    let mut idx = Indexer::new();
    let mut all_slices = vec![];
    for i in 0..8 {
        let spend = SpendKey::random(&mut rng);
        let view = ViewKey::random(&mut rng);
        let nonce = i as u64;
        all_slices.push((spend.public(), view.clone(), nonce));
        idx.register(SliceCredentials {
            slice_id: SliceId(i),
            view_key: view,
            spend_pub: spend.public(),
            nonce,
        });
    }

    let target_idx = 5usize;
    let (sp, vk, nonce) = &all_slices[target_idx];
    let addr = derive_stealth_address_with_nonce(sp, &vk.public(), *nonce, &mut rng);

    let deposit = synth_deposit(addr.stealth_pubkey, addr.ephemeral_r, addr.view_tag);
    let m = idx
        .scan(Pubkey::new_unique(), &deposit)
        .unwrap()
        .expect("must match slice 5");
    assert_eq!(m.slice_id, SliceId(target_idx as u64));
}
