import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import idl from "./solanaContractAbi/solanabet.json";
import ammIdl from "./solanaContractAbi/amm.json";
import bs58 from "bs58";
import { getAccount, getMint } from "@solana/spl-token";
import config from "../config";
import { decryptString } from "../library/crypto";

const SOLANA_NETWORK =
  process.env.NODE_ENV === "production"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";

const connection = new Connection(SOLANA_NETWORK, "confirmed");

const base58Key = decryptString(config.ADMIN_KEY);
if (!base58Key) console.error("Missing ADMIN_PRIVATE_KEY in environment");

const secret = bs58.decode(base58Key);
const adminWallet = Keypair.fromSecretKey(secret);
export const adminAddress = adminWallet.publicKey.toBase58();

const instabase58Key = decryptString(config.INSTA_ACCOUNT_KEY);
if (!instabase58Key) console.error("Missing ADMIN_PRIVATE_KEY in environment");
const instasecret = bs58.decode(instabase58Key);
const instaWallet = Keypair.fromSecretKey(instasecret);
export const instaWalletaddress = instaWallet.publicKey.toBase58();

const types = {
  crash: "crash",
  flip: "flip",
  airdrop: "airdrop",
  insta: "insta",
};

export const sendSol = async (toAddress, amount, type) => {
  try {
    if (!toAddress || !amount) {
      throw new Error("Missing toAddress or amount");
    }

    // BS-AUTH-008 fix: this gets reassigned below when `type` is truthy —
    // `const` threw a TypeError there, silently swallowed by the outer
    // catch, breaking the vault-deposit path.
    let receiver = new PublicKey(toAddress);

    if (type) {
      let [vault] = await getVaultPda();
       if(vault == ""){
         return {
        tx: "",
        status: false,
      };
       }  
      receiver = vault;
    }

    const balance = await connection.getBalance(
      type ? receiver : instaWallet.publicKey,
    );

    if (balance < amount * LAMPORTS_PER_SOL) {
      console.log("Insufficient Balance");
      return {
        tx: "",
        status: false,
      };
    }

    console.log(`Sending ${amount} SOL → ${receiver.toBase58()}`);

    let signature = null;
    let attempts = 0;

    while (!signature && attempts < 3) {
      try {
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: instaWallet.publicKey,
            toPubkey: receiver,
            lamports: Math.floor(amount * LAMPORTS_PER_SOL),
          }),
        );

        signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [instaWallet],
          { commitment: "confirmed" },
        );
      } catch (err) {
        console.error(`Attempt ${attempts + 1} failed:`, err.message);

        attempts++;

        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    if (!signature) {
      return {
        tx: "",
        status: false,
      };
    }

    console.log("Transaction confirmed:", signature);

    return {
      tx: signature,
      status: true,
    };
  } catch (err) {
    console.error("sendSol error:", err.message);

    return {
      tx: "",
      status: false,
    };
  }
};

export const verifyDeposit = async (txhash, expectedSender, expectedAmount) => {
  try{
  const tx = await connection.getParsedTransaction(txhash, {
    commitment: "confirmed",
  });
  console.log("🚀 ~ verifyDeposit ~ tx:", tx);

  if (!tx) {
    return false
  }

  const instructions = tx.transaction.message.instructions;
  console.log("🚀 ~ verifyDeposit ~ instructions:", instructions);

  let validTransfer = false;

  for (let ix of instructions) {
    console.log("🚀 ~ verifyDeposit ~ ix:", ix);

    if (ix.program === "system" && ix.parsed?.type === "transfer") {
      const info = ix.parsed.info;
      console.log("🚀 ~ verifyDeposit ~ info:", info);

      const sender = info.source;
      const receiver = info.destination;
      const lamports = info.lamports;

      if (
        sender === expectedSender &&
        receiver === config.INSTA_KEY &&
        lamports === expectedAmount * LAMPORTS_PER_SOL
      ) {
        validTransfer = true;
      }
    }
  }

  return validTransfer;
  }catch(err){
      console.log("🚀 ~ verifyDeposit ~ err:", err)
    return false
  }
};

export const verifyTransaction = async (signature) => {
  try {
    if (!signature)
      return {
        success: false,
        message: "Transaction signature required",
      };

    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    console.log("🚀 ~ verifyTransaction ~ tx:", tx);

    if (!tx) {
      return {
        success: false,
        message: "Transaction not found or not finalized yet.",
      };
    }

    const { meta, transaction, slot } = tx;

    // Check if failed
    const failed = !!meta?.err;
    console.log("🚀 ~ verifyTransaction ~ failed:", failed);

    // Get sender/receiver info (if available)
    const accountKeys = transaction.message.accountKeys.map((key) =>
      key.toBase58(),
    );
    console.log("🚀 ~ verifyTransaction ~ accountKeys:", accountKeys);
    const sender = accountKeys[0];
    console.log("🚀 ~ verifyTransaction ~ sender:", sender);
    const receiver = accountKeys[1];
    console.log("🚀 ~ verifyTransaction ~ receiver:", receiver);

    // Calculate amount transferred (in SOL)
    const lamportsChange = (meta?.preBalances[0] - meta?.postBalances[0]) / 1e9;
    console.log("🚀 ~ verifyTransaction ~ lamportsChange:", lamportsChange);

    return {
      success: !failed,
      status: failed ? false : true,
      signature,
      slot,
      sender,
      receiver,
      amount: lamportsChange - (meta?.fee ? meta.fee / 1e9 : 0),
      fee: meta?.fee ? meta.fee / 1e9 : 0,
      message: failed ? "Transaction failed" : "Transaction confirmed",
    };
  } catch (err) {
    console.error("verifyTransaction__err:", err.message);
    return {
      success: "error",
      status: false,
      message: err.message,
    };
  }
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
        result[key] = BigInt(value.toString());
      }
    } else {
      result[key] = value;
    }
  }
  return result;
};

export const getVaultPda = async () => {
  try{
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

  const program = new anchor.Program(idl, process.env.PROGRAM_ID, provider);

  let data = await program.account?.["bettingMachine"].fetch(
    process.env.AIRDROP_BETTING_MACHINE,
  );

  let betting_machine_data = await parseAnchorAccount(data);

  let [vault, _] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      new PublicKey(betting_machine_data?.oracle).toBuffer(),
      new PublicKey(process.env.AIRDROP_BETTING_MACHINE).toBuffer(),
    ],
    new PublicKey(process.env.PROGRAM_ID),
  );
  console.log("vault-->", vault);
  return [vault.toBase58()];
  }catch(err){
    return [""]
  }
};

export const getPoolDataFromContract = async () => {
  try{
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

  let pooldata = await program.account?.["poolState"].fetch(
    process.env.POOL_ADDRESS,
  );

  let parsedPoolData = await parseAnchorAccount(pooldata);
  return parsedPoolData;
   }catch(err){
   console.log("🚀 ~ getPoolDataFromContract ~ err:", err)
    return {}
  }
};

export const getMintDetail = async () => {
  try{
  let [poolMint] = await PublicKey.findProgramAddress(
    [
      Buffer.from("pool_mint"),
      new PublicKey(process.env.POOL_ADDRESS).toBuffer(),
    ],
    new PublicKey(process.env.AMM_ADDRESS),
  );

  const mintInfo = await getMint(connection, poolMint);
  console.log("🚀 ~ getMintDetail ~ mintInfo:", mintInfo);

  const totalLp = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);

  console.log("MintDetails", {
    totalLp,
    rawSupply: mintInfo.supply.toString(),
    decimals: mintInfo.decimals,
  });

  return {
    totalLp,
    rawSupply: mintInfo.supply.toString(),
    decimals: mintInfo.decimals,
  };
  }catch(err){
    return {}
  }
};

export const reserveGet = async (pk) => {
  const vaultSrc = await getAccount(connection, new PublicKey(pk));
  const reserve = Number(vaultSrc.amount.toString());
  return reserve;
};

export const getTokenPrice = async () => {
  let [vault0] = await PublicKey.findProgramAddress(
    [Buffer.from("vault0"), new PublicKey(process.env.POOL_ADDRESS).toBuffer()],
    new PublicKey(process.env.AMM_ADDRESS),
  );

  let reserve0 = await reserveGet(vault0);
  console.log("🚀 ~ getTokenPriceFromContract ~ reserve0:", reserve0);
  let [vault1] = await PublicKey.findProgramAddress(
    [Buffer.from("vault1"), new PublicKey(process.env.POOL_ADDRESS).toBuffer()],
    new PublicKey(process.env.AMM_ADDRESS),
  );
  let reserve1 = await reserveGet(vault1);
  console.log("🚀 ~ getTokenPriceFromContract ~ reserve1:", reserve1);

  let price1 = reserve1 / reserve0 / 10 ** 9;
  console.log("🚀 ~ getTokenPriceFromContract ~ price1:", price1);

  return {
    reserve0,
    reserve1,
    price1,
  };
};

export const verifySolanaTx = async (
  signature,
  expectedUser,
  type,
  amount,
  receiveAmount,
) => {
  try {
    console.log(
      "🚀 ~ verifySolanaTx ~ signature, expectedUser,type,amount:",
      signature,
      expectedUser,
      type,
      amount,
    );

    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    console.log("🚀 ~ verifySolanaTx ~ tx:", tx);

    if (!tx) throw new Error("Tx not found");

    if (tx.meta.err) throw new Error("Tx failed");

    const payer = tx.transaction.message.accountKeys[0].toBase58();
    console.log("🚀 ~ verifySolanaTx ~ payer:", payer);

    let transferAmountCheck = await getTokenTransfer(
      tx,
      expectedUser,
      type,
      amount,
      receiveAmount,
    );
    console.log(
      "🚀 ~ verifySolanaTx ~ transferAmountCheck:",
      transferAmountCheck,
    );

    if (payer !== expectedUser) {
      return { status: false };
    }

    return {
      status: true,
      ...transferAmountCheck,
    };
  } catch (err) {
    return {
      status: false,
      error: err.toString(),
    };
  }
};

const getTokenTransfer = async (tx, address, type, amount, receiveAmount) => {
  console.log(
    "🚀 ~ getTokenTransfer ~ tx,address,type,amount:",
    tx,
    address,
    type,
    amount,
    receiveAmount,
  );

  const pre = tx.meta.preTokenBalances;
  const post = tx.meta.postTokenBalances;

  const transfers = [];

  for (let i = 0; i < post.length; i++) {
    const preAmount = pre[i]?.uiTokenAmount?.amount || 0;
    const postAmount = post[i]?.uiTokenAmount?.amount || 0;

    const diff = postAmount - preAmount;

    if (diff !== 0) {
      transfers.push({
        mint: post[i].mint,
        owner: post[i].owner,
        amount: diff,
      });
    }
  }

  console.log("🚀 ~ getTokenTransfer ~ transfers:", transfers);

  let spent = [];
  let received = [];

  for (const t of transfers) {
    if (t.owner === address) {
      if (t.amount < 0) {
        spent.push({
          mint: t.mint,
          amount: Math.abs(t.amount),
        });
      }

      if (t.amount > 0) {
        received.push({
          mint: t.mint,
          amount: t.amount,
        });
      }
    }
  }

  console.log("🚀 ~ getTokenTransfer ~ received:", received);
  console.log("🚀 ~ getTokenTransfer ~ spent:", spent);
  console.log(
    "dfdedd-->",
    spent?.[0]?.amount,
    "amount-->",
    amount * 10 ** 9,
    "received?.[0]?.amount-->",
    received?.[0]?.amount,
    "receiveAmount * 10 ** 9-->",
    receiveAmount * 10 ** 9,
  );
  return {
    spend: spent?.[0]?.amount,
    recieved: received?.[0]?.amount,
  };
  // (spent?.[0]?.amount == (amount * 10 ** 9) && received?.[0]?.amount == (receiveAmount * 10 ** 9))
};
