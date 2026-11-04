
// Minimal x402 buyer for the Proof Rail payee check.
// The private key comes from BUYER_PRIVATE_KEY and is never printed.
//
//   npm install
//   export BUYER_PRIVATE_KEY=0x...
//   node x402-buyer.mjs 0xWALLET_TO_CHECK
import { randomBytes } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";

const url = process.env.URL || "https://proofrail.me/api/v1/agent/payee-check";
const wallet = process.argv[2];
const secret = process.env.BUYER_PRIVATE_KEY;

if (!secret) {
  console.error("Set BUYER_PRIVATE_KEY to a wallet that holds USDC. Do not commit it.");
  process.exit(1);
}

if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
  console.error("Usage: node x402-buyer.mjs 0xWALLET_TO_CHECK");
  process.exit(1);
}

const account = privateKeyToAccount(secret.trim());
const body = JSON.stringify({ wallet, chain: "evm" });
const headers = { "content-type": "application/json" };

const unpaid = await fetch(url, { method: "POST", headers, body });
console.log("unpaid status", unpaid.status);
const required = unpaid.headers.get("payment-required");

if (unpaid.status !== 402 || !required) {
  console.log("body", await unpaid.text());
  process.exit(1);
}

const doc = JSON.parse(Buffer.from(required, "base64").toString("utf8"));
const requirement = doc.accepts && doc.accepts[0];
const chain = /^eip155:(\d+)$/.exec(requirement && requirement.network);

if (!chain) {
  throw new Error("refusing network " + (requirement && requirement.network));
}

if (requirement.scheme !== "exact") {
  throw new Error("refusing scheme " + requirement.scheme);
}

console.log("payer", account.address);
console.log("payTo", requirement.payTo);
console.log("amount", requirement.amount, requirement.asset);
console.log("network", requirement.network);

const now = Math.floor(Date.now() / 1000);
const authorization = {
  from: account.address,
  to: requirement.payTo,
  value: requirement.amount,
  validAfter: String(now - 60),
  validBefore: String(now + Number(requirement.maxTimeoutSeconds || 60)),
  nonce: "0x" + randomBytes(32).toString("hex")
};

const signature = await account.signTypedData({
  domain: {
    name: requirement.extra.name,
    version: requirement.extra.version,
    chainId: Number(chain[1]),
    verifyingContract: requirement.asset
  },
  types: {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" }
    ]
  },
  primaryType: "TransferWithAuthorization",
  message: {
    from: authorization.from,
    to: authorization.to,
    value: BigInt(authorization.value),
    validAfter: BigInt(authorization.validAfter),
    validBefore: BigInt(authorization.validBefore),
    nonce: authorization.nonce
  }
});

const payload = {
  x402Version: 2,
  resource: doc.resource,
  accepted: requirement,
  payload: { signature, authorization }
};

if (doc.extensions) payload.extensions = doc.extensions;

const paid = await fetch(url, {
  method: "POST",
  headers: {
    ...headers,
    "payment-signature": Buffer.from(JSON.stringify(payload)).toString("base64")
  },
  body
});

console.log("paid status", paid.status);
const paymentResponse = paid.headers.get("payment-response");

if (paymentResponse) {
  const settlement = JSON.parse(Buffer.from(paymentResponse, "base64").toString("utf8"));
  console.log("settlement", settlement);

  if (settlement.transaction && requirement.network === "eip155:8453") {
    console.log("https://basescan.org/tx/" + settlement.transaction);
  }

  if (settlement.transaction && requirement.network === "eip155:84532") {
    console.log("https://sepolia.basescan.org/tx/" + settlement.transaction);
  }
}

console.log("body", await paid.text());
process.exit(paid.status === 200 ? 0 : 1);


