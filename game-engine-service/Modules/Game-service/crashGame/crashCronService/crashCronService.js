import {
  createNewCrashGame,
  fetchOnLiveGameData,
  getOrUpdateLiveGameData,
} from "../hooks/commonGamehook";
import BetModel from "../../gamemodel/BetSchema";
import TransactionModel from "../../gamemodel/TransactionSChema";
import { crashPubliser } from "../redis pub-sub/crash/crashpubliser/crashPubliser";
import { redisPubliser } from "../../../../service/redis/publisers/redisPublisers";
import UserSchema from "../../comonModel/UserSchema";
import { performAutoCashout } from "../hooks/crashBetHandler";
import solanaManager from "../../../../service/solanaManager";

export const handleCrashGameSession = async () => {
  try {
    let crashGame = await fetchOnLiveGameData();
    const now = new Date();
    if (!crashGame || crashGame.status === "finished") {
      if (crashGame && crashGame.status === "finished") {
        console.log("crashGame finished-->", crashGame);
        solanaManager.gameFinish({
          gameType: "crash",
          roundId: String(crashGame._id),
          serverSeed: crashGame?.gamedetails?.serverSeed,
          result: crashGame?.result,
        });
      }
      console.log("crashGamebefore-->", crashGame);
      await createNewCrashGame("crash");
      crashGame = await fetchOnLiveGameData();
      console.log("crashGameafter-->", crashGame);
      // await new Promise((res) => setTimeout(res, 2000));
      await crashPubliser("crash:game:new", crashGame);
      return;
    }

    const startTime = new Date(crashGame.startTime);
    const allowedBettingTill = new Date(crashGame.allowedBettingTill);
    const cashoutStartAt = new Date(crashGame.cashoutStartAt);
    const endTime = new Date(crashGame.endTime);
    // const multiplier = (gameEndTime - now) / 5500;
    let nextStatus = null;

    if (
      crashGame.status === "creating-onchain" &&
      now >= startTime &&
      now < allowedBettingTill
    ) {
      nextStatus = "accepting-Bets";
    } else if (
      crashGame.status === "accepting-Bets" &&
      now >= allowedBettingTill &&
      now < cashoutStartAt
    ) {
      nextStatus = "accepting-Bets-Ended";
    } else if (
      (crashGame.status === "accepting-Bets-Ended" ||
        crashGame.status === "accepting-Bets") &&
      now >= cashoutStartAt &&
      now < endTime
    ) {
      nextStatus = "in-progress";
    } else if (crashGame.status === "in-progress") {
      const TOTAL_PER_STEP = 5500; // ms per 1 multiplier
      const elapsed = now - cashoutStartAt;
      const result = Number(crashGame.result);

      // how many complete multiplier steps passed
      let currentMultiplier = 1 + elapsed / TOTAL_PER_STEP;
      console.log(
        "🚀 ~ handleCrashGameSession ~ currentMultiplier:",
        currentMultiplier,
        result,
      );

      // clamp
      if (currentMultiplier < 1) currentMultiplier = 1;
      if (currentMultiplier > result) currentMultiplier = result;

      performAutoCashout(currentMultiplier, crashGame._id);

      if (crashGame.status === "in-progress" && now >= endTime) {
        nextStatus = "finished";
      }
    } else if (now >= endTime && crashGame.status !== "finished") {
      nextStatus = "finished";
    }

    if (!nextStatus) return;

    await getOrUpdateLiveGameData(crashGame._id, nextStatus);

    if (nextStatus === "finished") {
      await markRemainingBetsBusted(crashGame._id);
      console.log("🚀 ~ handleCrashGameSession ~ crashGame:", crashGame);
    }
    crashGame = await fetchOnLiveGameData();
    await crashPubliser("crash:game:update", crashGame);

    // crashGame = await fetchOnLiveGameData();
    // await crashPubliser("crash:game:update", crashGame);
  } catch (err) {
    console.error("[CrashGame] handleCrashGameSession error:", err.message);
  }
};

export const markRemainingBetsBusted = async (gameId, io = null) => {
  try {
    // Find all pending bets for this game
    const activeBets = await BetModel.find({
      gameId,
      gameStatus: "in-play",
    });

    if (!activeBets.length) return;

    for (const bet of activeBets) {
      const lossAmountUI = bet.inPlayamountUI;

      // Update bet as busted
      bet.gameStatus = "busted";
      bet.profitLossAmount = -lossAmountUI;
      bet.inPlayamount = 0;
      bet.inPlayamountUI = 0;
      bet.profitamount = bet.profitamount;
      bet.profitamountUI = bet.profitamountUI;
      await bet.save();

      //user update to another service-publishing redies

      // const data = {
      //     userID: bet.userId,
      //     updateData: {
      //         $inc: {
      //             netProfit: -lossAmountUI,
      //         }
      //     }
      // }
      // await redisPubliser("User:Update", data)
      await UserSchema.findOneAndUpdate(
        { _id: bet.userId },
        {
          $inc: {
            netProfit: -lossAmountUI,
          },
        },
      );

      // // Optional: create a transaction record for busted loss
      // await TransactionModel.create({
      //     userId: bet.userId,
      //     fromAddress: bet.userId, // placeholder, user lost to platform
      //     toAddress: process.env.HOUSE_WALLET_ADDRESS || "PlatformWallet",
      //     transactionFrom: "crash",
      //     transactionType: "busted",
      //     transactionAsset: "SOL",
      //     transactionAmount: lossAmountUI,
      //     transactionHash: `busted-${Date.now()}`,
      //     referenceId: bet._id,
      //     status: "completed",
      // });

      // Emit to clients if needed
      await crashPubliser("crash:user:notification", {
        status: false,
        userId: bet.userId,
        gameId,
        lossAmount: lossAmountUI,
        time: new Date(),
        message: "busted",
      });
    }

    console.log(
      `[CrashGame] Marked ${activeBets.length} bets as busted for game ${gameId}`,
    );
  } catch (err) {
    console.error(
      "[CrashGame] markRemainingBetsBusted error:",
      err.message,
      err,
    );
  }
};
