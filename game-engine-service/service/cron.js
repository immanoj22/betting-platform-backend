import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import TransactionModel from "../Modules/Game-service/gamemodel/TransactionSChema";
import UserModel from "../Modules/Game-service/comonModel/UserSchema";
import solanaManager from "./solanaManager";
import UserSchema from "../Modules/Game-service/comonModel/UserSchema";
import { coinPubliser } from "../Modules/Game-service/coinFlip/redis pub-sub/coinflip/coinFlippubliser/coinFlipPublisher";

const types = {
  crash: "crash",
  flip: "flip",
  airdrop: "airdrop",
};

// BS-GAME-008 fix: terminal on-chain errors must stop the payout worker from
// retrying forever. Previously only `AlreadyRefunded` was treated as a
// success; any other unpayable-forever error (duplicate cashout, no wager,
// etc.) was resent every ~3s indefinitely, growing the pending backlog.
const TERMINAL_ON_CHAIN_ERRORS = [
  "AlreadyRefunded",
  "AlreadyCashedOut",
  "NoWager",
];

const isTerminalOnChainError = (tx) =>
  !tx?.status &&
  TERMINAL_ON_CHAIN_ERRORS.some((code) => tx?.err?.includes(code));

export const processCashouts = async () => {
  let transactions = await TransactionModel.find({
    status: "pending",
    transactionType: {
      $in: [
        "cashout",
        "partialCashout",
        "refund",
        "rewards_claim_sol",
        "rewards_claim_token",
        "rewards_claim_xp",
      ],
    },
  }).sort({ transactionAmount: 1 });
  console.log("🚀 ~ processCashouts ~ transactions:", transactions);
  if (transactions.length > 0) {
    for (let transaction of transactions) {
      console.log("🚀 ~ processCashouts ~ transaction:", transaction);
      let [vaultPda] = await solanaManager.getVaultPda(
        transaction?.transactionFrom == "coinflip"
          ? types.flip
          : transaction.transactionFrom == "system"
            ? types.airdrop
            : types.crash,
      );
      let vaultBalance =
        (await solanaManager.connection.getBalance(new PublicKey(vaultPda))) /
        LAMPORTS_PER_SOL;
      console.log("🚀 ~ processCashouts ~ vaultBalance:", vaultBalance);
      if (vaultBalance > transaction.transactionAmount) {
        let tx;
        if (transaction.transactionType == "refund") {
          tx = await solanaManager.refund({
            roundId: String(transaction.gameId),
            userPublicKey: new PublicKey(transaction.toAddress),
          });
        } else if (transaction?.transactionFrom == "coinflip") {
          let user = await UserModel.findOne({
            walletAddress: transaction.toAddress,
          }).lean();
          tx = await solanaManager.flipCashout(
            String(transaction.gameId),
            transaction.result == "LOW" ? 2 : 1,
            user?.role == "bot"
              ? transaction.toAddress
              : transaction?.isFromInstaWallet
                ? process.env.INSTA_ACCOUNT
                : transaction.toAddress,
          );
        } else if (transaction?.transactionFrom == "crash") {
          tx = await solanaManager.cashout({
            roundId: String(transaction.gameId),
            multiplierScaled: Math.floor(Number(transaction.result) * 1000), // 3.5x → 3500
            progressiveFraction:
              Number(transaction.progressCashOutPercentage) * 100, // convert to bp
            userPublicKey: new PublicKey(
              transaction?.isFromInstaWallet
                ? process.env.INSTA_ACCOUNT
                : transaction.toAddress,
            ),
          });
        } else {
          tx = await solanaManager.airdrop(
            transaction.toAddress,
            transaction.transactionAmount,
          );
        }
        console.log("tx-->", tx);
        if (
          tx?.status ||
          (!tx?.status && tx?.err?.includes("AlreadyRefunded"))
        ) {
          transaction.status = "completed";
          await TransactionModel.findOneAndUpdate(
            { _id: transaction?._id },
            {
              $set: {
                transactionHash: transaction.transactionHash
                  ? transaction.transactionHash
                  : tx?.txhash,
                status: "completed",
              },
            },
          );
          if (
            (transaction?.transactionFrom == "crash" ||
              transaction?.transactionFrom == "coinflip") &&
            transaction?.isFromInstaWallet
          ) {
            let userData = await UserSchema.findOneAndUpdate(
              { walletAddress: transaction.toAddress },
              {
                $inc: {
                  instawalletbalance: transaction?.transactionAmount, // winner:+profit, loser:-loss
                },
              },
            );
            await coinPubliser("user:notify", { userId: userData?._id });
          }
        } else if (isTerminalOnChainError(tx)) {
          // Dead-letter: this payout can never succeed on-chain — stop
          // retrying it instead of resending every ~3s forever.
          await TransactionModel.findOneAndUpdate(
            { _id: transaction?._id },
            {
              $set: {
                status: "failed",
                failureReason: tx?.err || "terminal on-chain error",
              },
            },
          );
        }
      }
    }
  }

  await new Promise((res) => setTimeout(res, 3000));
  return;
};

export const pendingCashOutPay = async () => {
  while (true) {
    try {
      await processCashouts(); // your main logic
    } catch (err) {
      console.error("pendingCashOutPay error:", err);
    }
  }
};
