import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import bs58 from "bs58";
import idl from "../solanaContractAbi/solanabet.json";
import { decryptObject, decryptString, encryptString } from "../library/crypto";
import config from "../config";
import TransactionModel from "../Modules/Game-service/gamemodel/TransactionSChema";
const types = {
  crash: "crash",
  flip: "flip",
  airdrop: "airdrop",
};
class SolanaManager {
  constructor() {
    const SOLANA_NETWORK =
      process.env.NODE_ENV === "production"
        ? "https://api.mainnet-beta.solana.com"
        : "https://api.devnet.solana.com";

    this.connection = new Connection(SOLANA_NETWORK, {
      commitment: "confirmed",
    });

    const ADMIN_PRIVATE_KEY = decryptString(config.ADMIN_KEY);

    if (!ADMIN_PRIVATE_KEY) console.error("Missing ADMIN_PRIVATE_KEY");

    this.adminWallet = Keypair.fromSecretKey(bs58.decode(ADMIN_PRIVATE_KEY));

    this.PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID);

    this.wallet = {
      publicKey: this.adminWallet.publicKey,
      signTransaction: async (tx) => {
        tx.partialSign(this.adminWallet);
        return tx;
      },
      signAllTransactions: async (txs) => {
        txs.forEach((tx) => tx.partialSign(this.adminWallet));
        return txs;
      },
    };

    const INSTA_ACCOUNT_PRIVATE_KEY = decryptString(config.INSTA_KEY);

    if (!INSTA_ACCOUNT_PRIVATE_KEY)
      console.error("Missing INSTA_ACCOUNT_PRIVATE_KEY");

    this.instaWallet = Keypair.fromSecretKey(
      bs58.decode(INSTA_ACCOUNT_PRIVATE_KEY),
    );

    this.instawallet = {
      publicKey: this.instaWallet.publicKey,
      signTransaction: async (tx) => {
        tx.partialSign(this.instaWallet);
        return tx;
      },
      signAllTransactions: async (txs) => {
        txs.forEach((tx) => tx.partialSign(this.instaWallet));
        return txs;
      },
    };

    const provider = new anchor.AnchorProvider(
      this.connection,
      this.wallet,
      anchor.AnchorProvider.defaultOptions(),
    );

    this.program = new anchor.Program(idl, this.PROGRAM_ID, provider);
  }

  async safeExecute(fn) {
    try {
      return await fn();
    } catch (err) {
      console.error("SolanaManager error:", err);
      return {
        status: false,
        err: err.message,
      };
    }
  }

  async readDataFromContract(key, pKey) {
    return await this.safeExecute(async () => {
      let data = await this.program.account?.[key].fetch(pKey);
      console.log("🚀 ~ SolanaManager ~ readDataFromContract ~ data:", data);
      let p_data = await this.parseAnchorAccount(data);
      console.log(
        "🚀 ~ SolanaManager ~ readDataFromContract ~ p_data:",
        p_data,
      );
      return p_data;
    });
  }

  parseAnchorAccount(obj) {
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
  }

  // ---------- PDA FUNCTIONS ----------

  getUserBetPda(roundId, userPubkey, type = types.crash) {
    return PublicKey.findProgramAddressSync(
      [
        ...(type == "flip"
          ? [Buffer.from("flipbet"), Buffer.from(roundId)]
          : [
              Buffer.from("betting"),
              new PublicKey(userPubkey).toBuffer(),
              Buffer.from(roundId),
            ]),
      ],
      this.PROGRAM_ID,
    );
  }

  async getVaultPda(type = types.flip) {
    let betting_machine_data = await this.readDataFromContract(
      "bettingMachine",
      type == "flip"
        ? process.env.FLIP_BETTING_MACHINE
        : type == "crash"
          ? process.env.CRASH_BETTING_MACHINE
          : process.env.AIRDROP_BETTING_MACHINE,
    );
    console.log(
      "🚀 ~ SolanaManager ~ getVaultPda ~ betting_machine_data:",
      betting_machine_data,
    );
    let [vault, _] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"),
        new PublicKey(betting_machine_data?.oracle).toBuffer(),
        new PublicKey(
          type == "flip"
            ? process.env.FLIP_BETTING_MACHINE
            : type == "crash"
              ? process.env.CRASH_BETTING_MACHINE
              : process.env.AIRDROP_BETTING_MACHINE,
        ).toBuffer(),
      ],
      this.PROGRAM_ID,
    );
    console.log("vault.toBase58()-->", vault.toBase58());
    return [vault.toBase58()];
  }

  // ---------- ON-CHAIN METHODS ----------
  async cashout({
    roundId,
    multiplierScaled,
    progressiveFraction,
    userPublicKey,
    betting_machine = process.env.CRASH_BETTING_MACHINE,
  }) {
    try {
      let betting_machine_data = await this.readDataFromContract(
        "bettingMachine",
        betting_machine,
      );
      const [userBet] = await this.getUserBetPda(
        roundId,
        userPublicKey,
        types.crash,
      );
      const [vault] = await this.getVaultPda(types.crash);

      const accounts = {
        user: userPublicKey,
        oracle: betting_machine_data?.oracle,
        bettingMachine: betting_machine,
        vault: vault,
        userBets: userBet,
        systemProgram: SystemProgram.programId,
      };
      console.log("🚀 ~ SolanaManager ~ cashout ~ accounts:", accounts);

      const txhash = await this.program.methods
        .cashout(
          String(roundId),
          new anchor.BN(multiplierScaled),
          new anchor.BN(progressiveFraction),
        )
        .accounts(accounts)
        .signers([this.adminWallet])
        .rpc();

      const status = async () => {
        return (
          (await this.connection.getSignatureStatus(txhash)).value
            .confirmationStatus === "confirmed"
        );
      };

      return {
        txhash,
        status: await status(),
      };
    } catch (err) {
      console.log("🚀 ~ SolanaManager ~ cashout ~ err:", err);
      if (err.logs) {
        const msg = err.logs.join("\n");

        if (msg.includes("insufficient lamports")) {
          return {
            err: "Insufficient funds in vault.",
            status: false,
          };
        }
        if (msg.includes("Already cashed out")) {
          return {
            err: "Already cashed out.",
            status: true,
          };
        }
        return {
          err: "Program error: " + msg,
          status: false,
        };
      }
    }
  }

  async flipCashout(
    roundId,
    selection,
    toAddress,
    betting_machine = process.env.FLIP_BETTING_MACHINE,
  ) {
    try {
      console.log(
        "roundId,selection,toAddress-->",
        roundId,
        selection,
        toAddress,
      );
      let betting_machine_data = await this.readDataFromContract(
        "bettingMachine",
        betting_machine,
      );
      console.log(
        "🚀 ~ SolanaManager ~ flipCashout ~ betting_machine_data:",
        betting_machine_data,
      );
      const [userBet] = await this.getUserBetPda(roundId, "", types.flip);
      console.log("🚀 ~ SolanaManager ~ flipCashout ~ userBet:", userBet);
      const [vault] = await this.getVaultPda(types.flip);
      console.log("🚀 ~ SolanaManager ~ flipCashout ~ vault:", vault);
      console.log(
        "sdsdsds1212121212-->",
        betting_machine_data?.oracle,
        betting_machine,
        vault,
        userBet,
        toAddress,
        SystemProgram.programId,
      );

      const accounts = {
        oracle: betting_machine_data?.oracle,
        bettingMachine: betting_machine,
        vault: vault,
        flipBet: userBet,
        to: new PublicKey(toAddress),
        systemProgram: SystemProgram.programId,
      };
      console.log("🚀 ~ SolanaManager ~ cashout ~ accounts:", accounts);

      const txhash = await this.program.methods
        .flipCashout(String(roundId), new anchor.BN(selection))
        .accounts(accounts)
        .signers([this.adminWallet])
        .rpc();
      console.log("🚀 ~ SolanaManager ~ flipCashout ~ txhash:", txhash);

      const status = async () => {
        return (
          (await this.connection.getSignatureStatus(txhash)).value
            .confirmationStatus === "confirmed"
        );
      };

      return {
        txhash,
        status: await status(),
      };
    } catch (err) {
      console.log("🚀 ~ SolanaManager ~ flipCashout ~ err:", err);
      if (err.logs) {
        const msg = err.logs.join("\n");

        if (msg.includes("insufficient lamports")) {
          return {
            err: "Insufficient funds in vault.",
            status: false,
          };
        }
        if (msg.includes("Already cashed out")) {
          return {
            err: "Already cashed out.",
            status: true,
          };
        }
        return {
          err: "Program error: " + msg,
          status: false,
        };
      }
    }
  }

  async refund({ roundId, userPublicKey }) {
    return await this.safeExecute(async () => {
      console.log(
        "🚀 ~ SolanaManager ~ refund ~ roundId, userPublicKey:",
        roundId,
        userPublicKey,
      );
      const globalState = process.env.CRASH_BETTING_MACHINE;
      console.log("🚀 ~ SolanaManager ~ refund ~ globalState:", globalState);
      const [userBet] = this.getUserBetPda(roundId, userPublicKey, "crash");
      console.log("🚀 ~ SolanaManager ~ refund ~ userBet:", userBet);
      const [vault] = await this.getVaultPda(types.crash);
      console.log("🚀 ~ SolanaManager ~ refund ~ vault:", vault);
      let accounts = {
        user: userPublicKey,
        oracle: this.adminWallet.publicKey,
        bettingMachine: new PublicKey(globalState),
        vault: vault,
        userBets: userBet,
        systemProgram: SystemProgram.programId,
      };
      console.log("🚀 ~ SolanaManager ~ refund ~ accounts:", accounts);
      console.log("this.wallet-->", this.wallet);
      const txhash = await this.program.methods
        .refund(roundId)
        .accounts(accounts)
        .signers([this.adminWallet])
        .rpc();
      console.log("txhash-->", txhash);
      const status = async () => {
        return (
          (await this.connection.getSignatureStatus(txhash)).value
            .confirmationStatus === "confirmed"
        );
      };

      return {
        txhash,
        status: await status(),
      };
    });
  }

  async airdrop(to, amount) {
    return await this.safeExecute(async () => {
      const [airdropVault] = await this.getVaultPda(types?.airdrop);

      let accounts = {
        bettingMachine: process.env.AIRDROP_BETTING_MACHINE,
        vault: airdropVault,
        to: to,
        authority: this.adminWallet.publicKey,
        systemProgram: SystemProgram.programId,
      };

      const txhash = await this.program.methods
        .airdrop(amount ** LAMPORTS_PER_SOL)
        .accounts(accounts)
        .signers([this.adminWallet])
        .rpc();
      console.log("txhash-->", txhash);
      const status = async () => {
        return (
          (await this.connection.getSignatureStatus(txhash)).value
            .confirmationStatus === "confirmed"
        );
      };

      return {
        txhash,
        status: await status(),
      };
    });
  }

  async gameCreate({ gameType, publicSeed, hashedServerSeed, roundId }) {
    console.log(
      `🚀 ~ SolanaManager ~ gameCreate ~ { gameType, publicSeed, hashedServerSeed, roundIdHash }:`,
      { gameType, publicSeed, hashedServerSeed, roundId },
      this.adminWallet.publicKey,
    );
    try {
      let bettingMachine =
        gameType == "flip"
          ? new PublicKey(process.env.FLIP_BETTING_MACHINE)
          : new PublicKey(process.env.CRASH_BETTING_MACHINE);
      console.log(
        "🚀 ~ SolanaManager ~ gameCreate ~ bettingMachine:",
        bettingMachine,
      );
      let [gamePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("game", "utf-8"),
          this.adminWallet.publicKey.toBuffer(),
          Buffer.from(roundId, "utf-8"),
        ],
        this.PROGRAM_ID,
      );
      console.log("🚀 ~ SolanaManager ~ gameCreate ~ gamePda:", gamePda);
      let accounts = {
        authority: this.adminWallet.publicKey,
        bettingMachine: bettingMachine,
        gamePda,
        systemProgram: SystemProgram.programId,
      };

      const txhash = await this.program.methods
        .gameCreate(
          String(gameType),
          String(roundId),
          String(publicSeed),
          String(hashedServerSeed),
        )
        .accounts(accounts)
        .signers([this.adminWallet])
        .rpc();
      console.log("🚀 ~ SolanaManager ~ gameCreate ~ txhash:", txhash);

      const status = async () => {
        return (
          (await this.connection.getSignatureStatus(txhash)).value
            .confirmationStatus === "confirmed"
        );
      };

      return {
        txhash,
        status: await status(),
      };
    } catch (err) {
      console.log("🚀 ~ SolanaManager ~ gameCreate ~ err:", err);
      if (err.logs) {
        const msg = err.logs.join("\n");

        if (msg.includes("insufficient lamports")) {
          return {
            err: "Insufficient funds in vault.",
            status: false,
          };
        }
        if (msg.includes("Already cashed out")) {
          return {
            err: "Already cashed out.",
            status: true,
          };
        }
        return {
          err: "Program error: " + msg,
          status: false,
        };
      }
    }
  }

  async gameFinish({ gameType, roundId, serverSeed, result }) {
    console.log(
      `🚀 ~ SolanaManager ~ gameFinish ~ { gameType, roundIdHash, serverSeed, result }:`,
      { gameType, roundId, serverSeed, result },
    );
    try {
      let bettingMachine =
        gameType == "flip"
          ? new PublicKey(process.env.FLIP_BETTING_MACHINE)
          : new PublicKey(process.env.CRASH_BETTING_MACHINE);
      let [gamePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("game", "utf-8"),
          this.adminWallet.publicKey.toBuffer(),
          Buffer.from(roundId, "utf-8"),
        ],
        this.PROGRAM_ID,
      );
      let accounts = {
        authority: this.adminWallet.publicKey,
        bettingMachine: bettingMachine,
        gamePda,
        systemProgram: SystemProgram.programId,
      };

      const txhash = await this.program.methods
        .gameFinish(
          String(roundId),
          String(serverSeed),
          new anchor.BN(parseFloat(result) * 10 ** 6),
        )
        .accounts(accounts)
        .signers([this.adminWallet])
        .rpc();
      console.log("🚀 ~ SolanaManager ~ gameFinish ~ txhash:", txhash);

      const status = async () => {
        return (
          (await this.connection.getSignatureStatus(txhash)).value
            .confirmationStatus === "confirmed"
        );
      };

      return {
        txhash,
        status: await status(),
      };
    } catch (err) {
      console.log("🚀 ~ SolanaManager ~ gameFinish ~ err:", err);
      if (err.logs) {
        const msg = err.logs.join("\n");

        if (msg.includes("insufficient lamports")) {
          return {
            err: "Insufficient funds in vault.",
            status: false,
          };
        }
        if (msg.includes("Already cashed out")) {
          return {
            err: "Already cashed out.",
            status: true,
          };
        }
        return {
          err: "Program error: " + msg,
          status: false,
        };
      }
    }
  }

  async verifyDeposit(txhash, expectedSender, expectedAmount) {
    console.log(
      "🚀 ~ SolanaManager ~ verifyDeposit ~ txhash, expectedSender, expectedAmount:",
      txhash,
      expectedSender,
      expectedAmount,
    );
    return await this.safeExecute(async () => {
      const tx = await this.connection.getParsedTransaction(txhash, {
        commitment: "confirmed",
      });
      console.log("🚀 ~ verifyDeposit ~ tx:", tx);
      let validTransfer = false;
      if (!tx) {
        return validTransfer;
      }

      const instructions = tx.transaction.message.instructions;
      console.log("🚀 ~ verifyDeposit ~ instructions:", instructions);

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
            receiver === (expectedReciever ?? config.INSTA_KEY) &&
            lamports === expectedAmount * LAMPORTS_PER_SOL
          ) {
            validTransfer = true;
          }
        }
      }

      return validTransfer;
    });
  }

  async verifyTransaction(signature, expectedSender, expectedAmount, expectedReceiver) {
    try {
      if (!signature)
        return {
          success: false,
          message: "Transaction signature required",
        };

      // Bug fix (BS-GAME-009, closing the residual gap): this previously
      // read the destination as `accountKeys[1]` — a positional guess that
      // only holds for the simplest possible transaction (a single bare
      // transfer with no other instructions). Any extra instruction ahead
      // of the transfer (a compute-budget instruction, a memo — both common
      // with modern wallets) shifts the account list and makes that guess
      // wrong. Switched to `getParsedTransaction` and reading the decoded
      // `system:transfer` instruction directly, the same reliable pattern
      // already used by the deposit-verification path in
      // auth-service/service/solanaTransactionService.js.
      const tx = await this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });

      if (!tx) {
        return false;
      }

      if (tx.meta?.err) {
        return false;
      }

      const instructions = tx.transaction.message.instructions;

      let sender = null;
      let receiver = null;
      let amount = null;

      for (const ix of instructions) {
        if (ix.program === "system" && ix.parsed?.type === "transfer") {
          const info = ix.parsed.info;
          sender = info.source;
          receiver = info.destination;
          amount = info.lamports / 1e9;
          break;
        }
      }

      // BS-GAME-009 fix: the destination must be the platform's own vault —
      // previously only the sender + amount were checked, so a deposit that
      // moved SOL to any account the "sender" controlled (including the
      // sender's own second wallet) passed verification. The expected
      // destination varies by caller (crash vault, flip vault, insta
      // account, ...), so it's passed in rather than assumed here.
      const destinationOk = expectedReceiver
        ? receiver === expectedReceiver
        : true;
      if (!expectedReceiver) {
        console.warn(
          "verifyTransaction called with no expectedReceiver — destination is NOT being checked for this call",
        );
      }

      // BS-GAME-010 fix: a transaction hash may only be used to seed one bet.
      const alreadyUsed = await TransactionModel.exists({
        transactionHash: signature,
      });

      let validTransfer = false;
      if (
        sender &&
        !alreadyUsed &&
        destinationOk &&
        sender === expectedSender &&
        Number(amount).toFixed(1) === Number(expectedAmount).toFixed(1)
      ) {
        validTransfer = true;
      }

      return validTransfer;
    } catch (err) {
      console.error("verifyTransaction__err:", err.message);
      return {
        success: "error",
        status: false,
        message: err.message,
      };
    }
  }

  async placeBet(
    roundId,
    autoCashoutScaled,
    amount,
    betting_machine = process.env.CRASH_BETTING_MACHINE,
  ) {
    let betting_maching_data = await this.readDataFromContract(
      "bettingMachine",
      betting_machine,
    );

    const [userBets] = await this.getUserBetPda(
      roundId,
      process.env.INSTA_ACCOUNT,
      types.crash,
    );

    const [vault] = await this.getVaultPda(types?.crash);

    const [airdropVault] = await this.getVaultPda(types?.airdrop);

    let accounts = {
      user: process.env.INSTA_ACCOUNT,
      oracle: betting_maching_data.oracle,
      bettingMachine: betting_machine,
      airdropMachine: process.env.AIRDROP_BETTING_MACHINE,
      userBets: userBets,
      vault: vault,
      airdropVault,
      systemProgram: SystemProgram.programId,
    };

    const txHash = await this.program.methods
      .placeBet(
        String(roundId),
        new anchor.BN(autoCashoutScaled),
        new anchor.BN(String(amount * LAMPORTS_PER_SOL)),
      )
      .accounts(accounts)
      .signers([this.instaWallet])
      .rpc();

    return {
      txHash,
      status: true,
    };
  }

  async createOrJoinBet(
    roundId,
    selection,
    amount,
    isJoin = false,
    isBot = false,
    betting_machine = process.env.FLIP_BETTING_MACHINE,
  ) {
    try {
      let betting_machine_data = await this.readDataFromContract(
        "bettingMachine",
        betting_machine,
      );

      const [flipBet] = await this.getUserBetPda(
        roundId,
        isBot ? this.adminWallet.publicKey : process.env.INSTA_ACCOUNT,
        types?.flip,
      );

      const [vault] = await this.getVaultPda(types?.flip);

      const [airdropVault] = await this.getVaultPda(types?.airdrop);

      let accounts = {
        user: isBot ? this.adminWallet.publicKey : process.env.INSTA_ACCOUNT,
        oracle: betting_machine_data.oracle,
        bettingMachine: betting_machine,
        airdropMachine: process.env.AIRDROP_BETTING_MACHINE,
        flipBet: flipBet,
        vault: vault,
        airdropVault,
        systemProgram: SystemProgram.programId,
      };
      console.log(
        "🚀 ~ SolanaManager ~ createOrJoinBet ~ accounts:",
        accounts,
        selection,
        amount * LAMPORTS_PER_SOL,
        isJoin,
        isBot,
      );

      const txHash = await this.program.methods
        .createOrJoinBet(
          String(roundId),
          new anchor.BN(selection),
          new anchor.BN(String(amount * LAMPORTS_PER_SOL)),
          isJoin,
          isBot,
        )
        .accounts(accounts)
        .signers([isBot ? this.adminWallet : this.instaWallet])
        .rpc();

      console.log("🚀 ~ createOrJoinBet ~ txHash:", txHash);

      // const status = async () => {
      //   return (
      //     (await this.connection.getSignatureStatus(txHash)).value
      //       .confirmationStatus === "confirmed"
      //   );
      // };

      return {
        txHash,
        status: true,
      };
    } catch (err) {
      console.log("🚀 ~ createOrJoinBet ~ err:", err);
      return {
        status: false,
      };
    }
  }
}

const solanaManager = new SolanaManager();

export default solanaManager;
