## What

<!-- One or two sentences. -->

## Why

<!-- The user-visible motivation, or the bug this fixes. -->

## How

<!-- High-level description of the change. -->

## Checklist

- [ ] `cargo test --workspace` passes
- [ ] `npm --prefix apps/api-gateway test` passes
- [ ] `npm --prefix apps/dashboard run build` passes
- [ ] If changing the stealth-address algorithm, the cross-language vector test
      and TS port were updated together
- [ ] If changing program account layout, LiteSVM integration tests still pass
- [ ] No keypairs, mnemonics, `.env` files, or other secrets are in the diff
