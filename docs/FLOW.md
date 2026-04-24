# NovaSupport End-to-End Flow

This document walks through the complete user journey from connecting a wallet to an on-chain support transaction landing on Stellar Testnet. Read this before diving into the codebase to understand how all the pieces fit together.

For deeper design context and technical decisions, see [ARCHITECTURE.md](../ARCHITECTURE.md).

## Overview

NovaSupport connects three layers:

- **Frontend**: Next.js 14 App Router application handling UI and wallet interactions
- **Backend**: Express + Prisma service storing profiles and transaction records
- **Contract**: Soroban smart contract emitting support events on-chain

## Flow Steps

### 1. Connect Wallet

The user connects their Freighter wallet to the application.

**What happens:**

1. User clicks "Connect Freighter" button
2. Frontend checks if Freighter extension is installed
3. Frontend requests permission via `@stellar/freighter-api`
4. On approval, the public key is retrieved and stored in component state
5. UI updates to show the connected address

**Key files:**

- `frontend/src/components/wallet-connect.tsx` — Wallet connection component using `getAddress`, `isAllowed`, and `setAllowed` from Freighter API

**Data flow:**

```
User → Freighter Extension → Frontend State
```

### 2. Create a Profile

A creator sets up their support page by filling out the profile form.

**What happens:**

1. Creator navigates to `/create`
2. Creator completes the multi-step form (display name, username, bio, wallet address, accepted assets, social links)
3. Frontend validates input client-side
4. Frontend POSTs to `POST /profiles` with the profile payload
5. Backend validates the request with Zod schemas
6. Backend creates `Profile` and associated `AcceptedAsset` records in PostgreSQL
7. Creator is redirected to `/profile/:username`

**Key files:**

- `frontend/src/app/create/page.tsx` — Multi-step profile creation form
- `backend/src/app.ts` — `POST /profiles` endpoint
- `backend/prisma/schema.prisma` — `Profile` and `AcceptedAsset` models

**API request:**

```
POST /profiles
{
  "username": "starvoyager",
  "displayName": "Star Voyager",
  "bio": "Building in the Stellar ecosystem",
  "walletAddress": "G...",
  "acceptedAssets": [{ "code": "XLM" }, { "code": "USDC", "issuer": "G..." }],
  "ownerId": "..."
}
```

**Data flow:**

```
Frontend Form → POST /profiles → Prisma → PostgreSQL
```

### 3. Support a Creator

A supporter visits a creator's profile page and prepares to send support.

**What happens:**

1. Supporter navigates to `/profile/:username`
2. Frontend fetches profile data from `GET /profiles/:username`
3. Profile page renders with creator info, accepted assets, and support panel
4. Supporter connects their Freighter wallet via the support panel
5. Supporter enters the amount and selects an asset

**Key files:**

- `frontend/src/app/profile/[username]/page.tsx` — Profile page with server-side data fetching
- `frontend/src/components/profile-card.tsx` — Displays creator information
- `frontend/src/components/support-panel.tsx` — Support intent UI with wallet connection
- `backend/src/app.ts` — `GET /profiles/:username` endpoint

**Data flow:**

```
GET /profiles/:username → Frontend → Render Profile + Support Panel
```

### 4. Sign & Submit Transaction

The supporter signs and submits the support transaction to Stellar Testnet.

**What happens:**

1. Frontend builds a Stellar payment transaction using `@stellar/stellar-sdk`
2. Frontend prepares a Soroban contract invocation calling `support()` on the contract
3. Freighter opens for transaction approval
4. Supporter reviews and signs the transaction
5. Signed XDR is submitted to Horizon Testnet
6. Transaction is confirmed on-chain

**Key files:**

- `frontend/src/lib/stellar.ts` — Stellar SDK configuration and helpers
- `frontend/src/components/support-panel.tsx` — Transaction preparation (placeholder for full implementation)
- `contract/contracts/support_page/src/lib.rs` — Soroban contract source

**Data flow:**

```
Frontend → Build TX → Freighter Sign → Horizon Testnet → On-chain
```

### 5. Contract Event Emitted

The Soroban contract emits a `SupportEvent` when the transaction executes.

**What happens:**

1. Contract `support()` function executes with supporter authorization
2. Contract validates that amount is positive
3. Contract increments the global support counter
4. Contract emits a `support` event with the full payload
5. Event is visible on Stellar Expert and other block explorers

**Key files:**

- `contract/contracts/support_page/src/lib.rs` — Contract implementation
- `contract/ABI.md` — Contract ABI documentation

**Event payload:**

```json
{
  "supporter": "G...",
  "recipient": "G...",
  "amount": 10000000,
  "asset_code": "XLM",
  "message": "Keep building!"
}
```

**Data flow:**

```
Contract Execution → Event Emission → Stellar Ledger → Block Explorers
```

### 6. Record in Database

The frontend records the completed transaction in the backend database.

**What happens:**

1. After Horizon confirms the transaction, frontend receives the transaction hash
2. Frontend POSTs to `POST /support-transactions` with transaction details
3. Backend validates the payload
4. Backend creates a `SupportTransaction` record linked to the profile
5. Backend returns the created record

**Key files:**

- `backend/src/app.ts` — `POST /support-transactions` endpoint
- `backend/prisma/schema.prisma` — `SupportTransaction` model

**API request:**

```
POST /support-transactions
{
  "txHash": "abc123...",
  "amount": "100",
  "assetCode": "XLM",
  "status": "confirmed",
  "message": "Keep building!",
  "stellarNetwork": "TESTNET",
  "supporterAddress": "G...",
  "recipientAddress": "G...",
  "profileId": "..."
}
```

**Data flow:**

```
Frontend → POST /support-transactions → Prisma → PostgreSQL
```

### 7. View Support History

The profile page displays the transaction history with links to Stellar Expert.

**What happens:**

1. Profile page fetches transactions from `GET /profiles/:username/transactions`
2. Backend queries `SupportTransaction` records for the profile's wallet address
3. Frontend renders transaction list with amount, asset, message, and timestamp
4. Each transaction links to Stellar Expert using the transaction hash

**Key files:**

- `frontend/src/app/profile/[username]/page.tsx` — Fetches transactions via `getTransactions()`
- `frontend/src/components/profile-tabs.tsx` — Transaction history display
- `backend/src/app.ts` — `GET /profiles/:username/transactions` endpoint

**Stellar Expert link format:**

```
https://stellar.expert/explorer/testnet/tx/{txHash}
```

**Data flow:**

```
GET /profiles/:username/transactions → Frontend → Render History with Explorer Links
```

## Data Models

The backend stores three primary models. See `backend/prisma/schema.prisma` for the full schema.

| Model | Purpose |
| --- | --- |
| `Profile` | Creator profile with wallet address, bio, and social links |
| `AcceptedAsset` | Assets a creator accepts (XLM, USDC, etc.) |
| `SupportTransaction` | Record of each support transaction with hash, amount, and status |

## Network Configuration

NovaSupport targets Stellar Testnet for safe, cost-free testing during development.

| Setting | Value |
| --- | --- |
| Network | Stellar Testnet |
| Horizon URL | `https://horizon-testnet.stellar.org` |
| Network Passphrase | `Test SDF Network ; September 2015` |

Configuration is set via environment variables in `frontend/.env.local` and `backend/.env`.

## Next Steps

After reading this flow:

1. Set up the development environment following [README.md](../README.md)
2. Review [ARCHITECTURE.md](../ARCHITECTURE.md) for design decisions
3. Explore the contract ABI in [contract/ABI.md](../contract/ABI.md)
4. Check [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines
