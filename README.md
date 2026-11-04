
# proofrail-x402-example

A minimal buyer for the Proof Rail payee check over x402.

Proof Rail tells an agent whether a wallet is verified to belong to the payee it expects, before it sends funds. Each check costs 0.01 USDC on Base mainnet and returns a signed receipt (PRC-...).

## What happens

1. The script POSTs to https://proofrail.me/api/v1/agent/payee-check with `{"wallet":"0x...","chain":"evm"}`.
2. The server replies 402 with the payment terms in the `PAYMENT-REQUIRED` header.
3. The script signs a USDC transferWithAuthorization (EIP-3009). You pay no gas.
4. It retries with the payment, and prints the result and receipt.

## Run it

Needs Node 20+ and a Base wallet holding a little USDC. Use a dedicated low-balance wallet.

```
npm install
export BUYER_PRIVATE_KEY=0x...   # your own wallet, never commit it
node x402-buyer.mjs 0xWALLET_TO_CHECK
```

## Limits

- 0.01 USDC per check, settled by the Coinbase CDP facilitator, which screens payer wallets for sanctions.
- Each payer wallet is capped at $100 per calendar month.
- Rate limits apply per IP and per payer wallet.
- Need more volume or an invoice? Ask for a named API key.

## Terms

Paying for a check means you accept https://proofrail.me/terms. Proof Rail is operated by House of Borel LLC d/b/a Proof Rail. A result describes what we could verify at the time of the check. It is not a promise about the counterparty.

## License

MIT


