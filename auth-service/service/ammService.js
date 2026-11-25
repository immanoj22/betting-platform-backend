import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  ComputeBudgetProgram
} from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import ammIdl from "./solanaContractAbi/amm.json";
import bs58 from "bs58";
import { getAssociatedTokenAddress ,TOKEN_PROGRAM_ID} from "@solana/spl-token";
import { decryptString } from "../library/crypto";
import config from "../config"
const SOLANA_NETWORK =
  process.env.NODE_ENV === "production"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";

const connection = new Connection(SOLANA_NETWORK, "confirmed");

const base58Key = decryptString(config.ADMIN_KEY);
if (!base58Key) console.error("Missing ADMIN_PRIVATE_KEY in environment")
const secret = bs58.decode(base58Key);
const adminWallet = Keypair.fromSecretKey(secret);
export const adminAddress = adminWallet.publicKey.toBase58();

let instabase58Key = decryptString(config.INSTA_ACCOUNT_KEY);
if (!instabase58Key)
  console.error("Missing ADMIN_PRIVATE_KEY in environment")
const instasecret = bs58.decode(instabase58Key);
const instaWallet = Keypair.fromSecretKey(instasecret);
export const instaWalletaddress = instaWallet.publicKey.toBase58();

const wallet = {
  publicKey: adminWallet.publicKey,
  signTransaction: async (tx) => {
    tx.partialSign(adminWallet);
    return tx;
  },
  signAllTransactions: async (txs) => {
    txs.forEach((tx) => tx.partialSign(adminWallet));
    return txs;
  },
};

const provider = new anchor.AnchorProvider(
  connection,
  wallet,
  anchor.AnchorProvider.defaultOptions(),
);

const program = new anchor.Program(ammIdl, process.env.AMM_ADDRESS, provider);

export const swap = async (side, amount) => {
  try {
    let srcMint, dstMint, vaultSrc, vaultDst, userSrc, userDst;

    let payer = wallet.publicKey;

    let [vault0] = await PublicKey.findProgramAddress(
      [
        Buffer.from("vault0"),
        new PublicKey(process.env.POOL_ADDRESS).toBuffer(),
      ],
      new PublicKey(process.env.AMM_ADDRESS),
    );

    let [vault1] = await PublicKey.findProgramAddress(
      [
        Buffer.from("vault1"),
        new PublicKey(process.env.POOL_ADDRESS).toBuffer(),
      ],
      new PublicKey(process.env.AMM_ADDRESS),
    );

    if (side == "buy") {
      srcMint = new PublicKey(process.env.MINT0);
      dstMint = new PublicKey(process.env.MINT1);
      vaultSrc = new PublicKey(vault0);
      vaultDst = new PublicKey(vault1);
    } else {
      srcMint = new PublicKey(process.env.MINT1);
      dstMint = new PublicKey(process.env.MINT0);
      vaultSrc = new PublicKey(vault1);
      vaultDst = new PublicKey(vault0);
    }

    userSrc = await getAssociatedTokenAddress(srcMint, payer);

    userDst = await getAssociatedTokenAddress(dstMint, payer);

    let [poolAuthority] = await PublicKey.findProgramAddress(
      [
        Buffer.from("authority"),
        new PublicKey(process.env.POOL_ADDRESS).toBuffer(),
      ],
      new PublicKey(process.env.AMM_ADDRESS),
    );

    let accounts = {
      poolState: process.env.POOL_ADDRESS,
      poolAuthority: new PublicKey(poolAuthority),
      vaultSrc,
      vaultDst,
      userSrc,
      userDst,
      owner: provider.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    console.log("🚀 ~ swap ~ accounts:", accounts);
    let amount_liq0 = new anchor.BN(amount * 10 ** 9);

    const { expectedAmountOut, minimumAmountOut, slippagePercent } =
      await getMinimumAmountOut({
        amountIn: amount * 10 ** 9,
        direction: side,
      });

    console.log(
      "🚀 ~ swap ~ expectedAmountOut, minimumAmountOut, slippagePercent:",
      expectedAmountOut,
      minimumAmountOut,
      slippagePercent,
    );

    // Bug fix (BS-AMM-005 / same slippage bug as BS-FE-001): this was
    // passing the raw expectedAmountOut instead of the slippage-adjusted
    // minimumAmountOut computed just above — no real slippage protection on
    // this backend-signed swap, and swaps tended to revert `NotEnoughOut`.
    let minimumAmountOutBN = new anchor.BN(Math.floor(minimumAmountOut));

    let transaction = await program.methods
      .swap(amount_liq0, minimumAmountOutBN)
      .accounts(accounts)
      .signers([wallet.publicKey])
      .transaction();

    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
    );

    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
    );

    transaction.feePayer = wallet.publicKey; // null;
    const { blockhash } = await connection.getLatestBlockhash();
    console.log("🚀 ~ bidforlending ~ blockhash:", blockhash);
    transaction.recentBlockhash = blockhash;
    console.log("🚀 ~ bidforlending ~ transaction:", transaction);
    const signed = await wallet.signTransaction(transaction);
    console.log("🚀 ~ bidforlending ~ signed:", signed);
    const signature = await connection.sendRawTransaction(signed.serialize());
    console.log("🚀 ~ bidforlending ~ signature:", signature);
    if (signature) {
      console.log(
        "TransactionHash",
        `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      );
    }

    let returnData = {
      txHash: signature,
      status: true,
    };

    return returnData;
  } catch (err) {
    console.log("🚀 ~ swap ~ err:", err);
    return {
      msg: err.toString(),
      status: false,
    };
  }
};

export const getMinimumAmountOut = async ({ amountIn, direction }) => {
  let poolData = await readDataFromContract(
    "poolState",
    process.env.POOL_ADDRESS,
  );
  console.log("🚀 ~ getMinimumAmountOut ~ poolData:", poolData);

  let feeNumerator = poolData.feeNumerator;
  console.log("🚀 ~ getMinimumAmountOut ~ feeNumerator:", feeNumerator);
  let feeDenominator = poolData.feeDenominator;
  console.log("🚀 ~ getMinimumAmountOut ~ feeDenominator:", feeDenominator);

  let [vault0] = await PublicKey.findProgramAddress(
    [Buffer.from("vault0"), new PublicKey(process.env.POOL_ADDRESS).toBuffer()],
    new PublicKey(process.env.AMM_ADDRESS),
  );
  console.log("🚀 ~ getMinimumAmountOut ~ vault0:", vault0);

  let [vault1] = await PublicKey.findProgramAddress(
    [Buffer.from("vault1"), new PublicKey(process.env.POOL_ADDRESS).toBuffer()],
    new PublicKey(process.env.AMM_ADDRESS),
  );
  console.log("🚀 ~ getMinimumAmountOut ~ vault1:", vault1);

  let reserveIn = await reserveGet(direction === "buy" ? vault0 : vault1);
  console.log("🚀 ~ getMinimumAmountOut ~ reserveIn:", reserveIn);
  let reserveOut = await reserveGet(direction === "buy" ? vault1 : vault0);
  console.log("🚀 ~ getMinimumAmountOut ~ reserveOut:", reserveOut);

  // amount in after fee
  const amountInAfterFee =
    (amountIn * (feeDenominator - feeNumerator)) / feeDenominator;
  console.log("🚀 ~ getMinimumAmountOut ~ amountInAfterFee:", amountInAfterFee);

  // constant product
  const k = reserveIn * reserveOut;
  console.log("🚀 ~ getMinimumAmountOut ~ k:", k);
  const newReserveIn = reserveIn + amountInAfterFee;
  console.log("🚀 ~ getMinimumAmountOut ~ newReserveIn:", newReserveIn);
  const newReserveOut = k / newReserveIn;
  console.log("🚀 ~ getMinimumAmountOut ~ newReserveOut:", newReserveOut);

  const amountOut = reserveOut - newReserveOut;
  console.log("🚀 ~ getMinimumAmountOut ~ amountOut:", amountOut);

  let spotPrice = reserveOut / reserveIn;
  let expectedOut = amountIn * spotPrice;

  let slippage = (expectedOut - amountOut) / expectedOut;

  // execution price of this swap
  const executionPrice = amountOut / amountInAfterFee;

  let priceImpact = (spotPrice - executionPrice) / spotPrice;

  const minAmountOut = (amountOut * (10_000 - slippage)) / 10_000;
  console.log("🚀 ~ getMinimumAmountOut ~ minAmountOut:", minAmountOut);

  return {
    priceImpact,
    expectedAmountOut: amountOut,
    minimumAmountOut: minAmountOut,
    slippagePercent: Number(slippage) / 100,
    reserveIn,
    reserveOut,
  };
};

const reserveGet = async (pk) => {
  const vaultSrc = await connection.getTokenAccountBalance(new PublicKey(pk));
  const reserve = Number(vaultSrc.value.amount.toString()); //new anchor.BN(vaultSrc.amount.toString());
  return reserve;
};

const readDataFromContract = async (key, pKey) => {
  let data = await program.account?.[key].fetch(pKey);
  return parseAnchorAccount(data);
};

const parseAnchorAccount = (obj) => {
  const result = {};
  for (const key in obj) {
    const value = obj[key];
    if (value instanceof PublicKey) {
      result[key] = value.toBase58();
    } else if (value instanceof anchor.BN) {
      if (value.bitLength() < 53) {
        result[key] = value.toNumber();
      } else {
        result[key] = new anchor.BN(value.toString());
      }
    } else {
      result[key] = value;
    }
  }
  return result;
};

export const burnToken = async (amount) => {
  try {
    let [poolMint] = await PublicKey.findProgramAddress(
      [
        Buffer.from("pool_mint"),
        new PublicKey(process.env.POOL_ADDRESS).toBuffer(),
      ],
      new PublicKey(process.env.AMM_ADDRESS),
    );

    let userTokenAccount = await getAssociatedTokenAddress(
      poolMint,
      adminWallet.publicKey,
    );

    let accounts = {
      payer: adminAddress,
      user: adminAddress,
      userTokenAccount,
      tokenMint: poolMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    };

    let transaction = await program.methods
      .burnToken(amount)
      .accounts(accounts)
      .signers([wallet.publicKey])
      .transaction();

    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
    );

    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
    );

    transaction.feePayer = adminWallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    console.log("🚀 ~ bidforlending ~ blockhash:", blockhash);
    transaction.recentBlockhash = blockhash;
    console.log("🚀 ~ bidforlending ~ transaction:", transaction);
    const signed = await wallet.signTransaction(transaction);
    console.log("🚀 ~ bidforlending ~ signed:", signed);
    const signature = await connection.sendRawTransaction(signed.serialize());
    console.log("🚀 ~ bidforlending ~ signature:", signature);
    if (signature) {
      console.log(
        "TransactionHash",
        `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      );
    }

    let returnData = {
      txHash: signature,
      status: true,
    };

    return returnData;
  } catch (err) {
    console.log("🚀 ~ swap ~ err:", err);
    return {
      msg: err.toString(),
      status: false,
    };
  }
};
