# betting-platform-backend

The backend for a centralized online betting site. The platform runs everything on its own servers: accounts, balances, the games and the results. Players sign in and get a wallet that the platform holds for them, and deposits, bets and payouts move through Solana as the payment rail. It is split into two Node services that share a MongoDB database and talk through Redis.

I worked on this as part of a team, mostly on bug fixes and the audit fixes. This is a cleaned copy: the keys, env files and uploaded files are removed and the branding is generic.

## Services

| Service | Port | What it does |
|---|---|---|
| `auth-service` | 2002 | Accounts, sign-in with email, Google or Twitter, platform-held wallets, admin API, levels and reward boxes, airdrop, a token swap pool, chat |
| `game-engine-service` | 2003 | Runs the games on the server: crash and coin flip. Accepts bets, decides results, pays out, keeps live game state |

```mermaid
flowchart LR
    P["Player"] -->|"REST"| A["auth-service"]
    P -->|"Socket IO"| G["game-engine-service"]
    P -->|"Socket IO"| A
    A --> DB[("MongoDB")]
    G --> DB
    A <-->|"pub/sub"| R[("Redis")]
    G <-->|"pub/sub"| R
    A -->|"payments"| SOL["Solana network"]
    G -->|"payouts"| SOL
    A --> OA["Google and Twitter OAuth"]
    A --> ML["Email and SMS"]
```

## What is in it

- Crash game: a rising multiplier with a live round, bets and cash-outs over Socket.IO
- Coin flip: create a game, join against it, or play the bot
- Server-side results: the server seed, client seed and nonce are combined and the round result is generated from that seed on the server
- Bets, wins and deposits are recorded as transactions in MongoDB and paid through Solana with the Anchor client (devnet or mainnet by `NODE_ENV`)
- Custodial wallets: the platform creates a keypair for each user, keeps it, and AES-encrypts the private key before storing it. A house wallet funds payouts
- Daily reward boxes and levels, an airdrop cron job, and a token swap pool with its own contract interface
- Admin API for users, games, configuration and reports with CSV and PDF export
- Rate limiting, Helmet, input sanitising for MongoDB, httpOnly auth cookie plus JWT

## Tech stack

Node.js 22, Express, Socket.IO, MongoDB with Mongoose, Redis (ioredis), Solana web3.js (payments), Anchor, SPL token, Babel, Passport, JWT, node-cron, ExcelJS and PDFKit.

## Running it

You need Node 22, MongoDB and Redis, plus a Solana wallet for the house account.

```
cd auth-service
cp Environment/.env.example Environment/.env.local   # fill in
npm install
NODE_ENV=local node babel_hook.js
```

Do the same in `game-engine-service`. The wallet, program ids and keys in the env files have to be your own; devnet works for testing. The interfaces for the payment programs are in `solanaContractAbi/`. The AMM program address in `amm.json` is a placeholder.

## Notes

- Several secrets (`SECRET_KEY`, `JWT_SECRET`, `WALLET_ENCRYPTION_KEY`, `SESSION_SECRET`) should be four different values. The code falls back to `SECRET_KEY` if the others are not set.
- There are no automated tests.
- This is only a backend. The player site and the admin site are separate projects and are not included.
