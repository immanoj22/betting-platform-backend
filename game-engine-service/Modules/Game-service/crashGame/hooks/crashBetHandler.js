import mongoose from "mongoose";
import GameSessionModel from "../../gamemodel/gameSession.js";
import BetModel from "../../gamemodel/BetSchema.js";
import TransactionModel from "../../gamemodel/TransactionSChema.js";

import { redisPubliser } from "../../../../service/redis/publisers/redisPublisers.js";
import UserSchema from "../../comonModel/UserSchema.js";
import { crashPubliser } from "../redis pub-sub/crash/crashpubliser/crashPubliser.js";
import { fetchOnLiveGameData } from "./commonGamehook.js";
import gameConfig from "../../comonModel/gameConfig.js";
import { PublicKey } from "@solana/web3.js";
import solanaManager from "../../../../service/solanaManager.js";

const toLamports = (sol) => (isNaN(sol) ? 0 : Math.floor(sol * 1e9));
const fromLamports = (lamports) => (isNaN(lamports) ? 0 : lamports / 1e9);

export const placegameBet = async (data) => {
  console.log("placg", data);
  try {
    let {
      userDetails,
      amount,
      transactionHash,
      gameId,
      autoCashOut = 0,
      currentBetTime,
    } = data;

    if (!userDetails?._id || !amount || !gameId || !currentBetTime) {
      return {
        status: false,
        message: "Missing required fields",
        userID: userDetails._id,
      };
    }

    if (!userDetails?.instawalletEnable && !transactionHash) {
      return {
        status: false,
        message: "transactionHash required fields",
        userID: userDetails._id,
      };
    }

    if (isNaN(amount) || amount <= 0) {
      return {
        status: false,
        message: "Invalid bet amount",
        userID: userDetails._id,
      };
    }

    const gameDetails = await GameSessionModel.findById(gameId);
    if (!gameDetails)
      return {
        status: false,
        message: "Game not found",
        userID: userDetails._id,
      };

    const betTime = new Date(currentBetTime);
    const endTime = new Date(gameDetails.allowedBettingTill);

    if (betTime >= endTime) {
      try {
        if (userDetails.instawalletEnable) {
          return {
            status: false,
            message: "Betting closed",
            userID: userDetails._id,
          };
        }
        let [valut] = await solanaManager.getVaultPda("crash");
        await TransactionModel.create({
          userId: userDetails._id,
          fromAddress: new PublicKey(valut).toString() || "admin wallet",
          toAddress: userDetails.walletAddress,
          transactionFrom: "crash",
          transactionType: "refund",
          transactionAsset: "SOL",
          transactionAmount: amount,
          transactionHash: "",
          gameId,
          isFromInstaWallet: userDetails?.instawalletEnable == true,
          status: userDetails?.instawalletEnable ? "completed" : "pending",
          referenceId: gameId,
        });

        return {
          status: false,
          message: "Betting closed, refund issued",
          userID: userDetails._id,
        };
      } catch (refundErr) {
        console.error("Refund failed:", refundErr.message);
        return {
          status: false,
          message: "Refund failed on-chain",
          userID: userDetails._id,
        };
      }
    }

    const existingBet = await BetModel.findOne({
      userId: userDetails._id,
      gameId,
      gameStatus: "in-play",
    });

    if (existingBet) {
      return {
        status: false,
        message: "You already have an active bet in this game",
        userID: userDetails._id,
      };
    }

    if (isNaN(betTime.getTime())) {
      return {
        status: false,
        message: "Invalid currentBetTime format",
        userID: userDetails._id,
      };
    }

    let gameConfigData = await gameConfig.findOne({
      gameType: "crash",
    });
    if (amount < gameConfigData.minBetAmount) {
      return {
        status: false,
        message: `minimum bet amount should be ${gameConfigData.minBetAmount}`,
      };
    }
    if (amount > gameConfigData.maxBetAmount) {
      return {
        status: false,
        message: `maximum bet amount should be ${gameConfigData.maxBetAmount}`,
      };
    }

    // BS-GAME-005 fix: reserve the wager against a live, atomically-guarded
    // balance ($gte) instead of trusting the stale in-memory snapshot and
    // debiting later with an unguarded $inc. This is the single point where
    // the insta-wallet balance is touched for this bet — concurrent bets can
    // no longer race past each other into a negative balance.
    if (userDetails.instawalletEnable) {
      const reserved = await UserSchema.findOneAndUpdate(
        { _id: userDetails._id, instawalletbalance: { $gte: amount } },
        { $inc: { instawalletbalance: -Number(amount) } },
        { new: true },
      );
      if (!reserved) {
        return {
          status: false,
          message: "Insufficient Balance In Insta Wallet",
          userID: userDetails._id,
        };
      }
    }

    if (userDetails.instawalletEnable) {
      transactionHash = await solanaManager.placeBet(
        gameId,
        Number(autoCashOut ?? 0) * 1000,
        amount,
      );
      console.log("🚀 ~ placegameBet ~ transactionHash:", transactionHash);
      if (transactionHash?.status) {
        transactionHash = transactionHash?.txHash;
      } else {
        // On-chain placement failed after the reservation succeeded — refund
        // the reserved balance so the user isn't charged for a bet that was
        // never placed.
        await UserSchema.findOneAndUpdate(
          { _id: userDetails._id },
          { $inc: { instawalletbalance: Number(amount) } },
        );
        return {
          status: false,
          message: "Somthing issue. Please try again later",
          userID: userDetails._id,
        };
      }
    }

    if (!userDetails.instawalletEnable) {
      // BS-GAME-009 fix: pass this game's actual vault as the expected
      // deposit destination (previously unchecked).
      const [crashVault] = await solanaManager.getVaultPda("crash");
      let txVerify = await solanaManager.verifyTransaction(
        transactionHash,
        userDetails.instawalletEnable
          ? process.env.INSTA_ACCOUNT
          : userDetails.walletAddress,
        amount,
        crashVault,
      );
      console.log("🚀 ~ placegameBet ~ txVerify:", txVerify);
      if (!txVerify) {
        return {
          status: false,
          message: "Invalid Transaction Hash",
          userID: userDetails._id,
        };
      }
    }

    const amountLamports = toLamports(amount);
    console.log("🚀 ~ placegameBet ~ amountLamports:", amountLamports, amount);
    const newBet = await BetModel.create({
      userId: userDetails._id,
      gameId,
      betamount: amountLamports,
      betamountUI: amount,
      inPlayamount: amountLamports,
      inPlayamountUI: amount,
      profitamount: 0,
      profitamountUI: 0,
      transactionHash,
      autoCashOut,
      profitLossAmount: 0,
      isFromInstaWallet: userDetails?.instawalletEnable,
    });
    console.log("🚀 ~ placegameBet ~ newBet:", newBet);

    const [vault] = await solanaManager.getVaultPda();
    await TransactionModel.create({
      userId: userDetails._id,
      fromAddress: userDetails?.walletAddress || "fromaddd",
      toAddress: new PublicKey(vault).toString() || "reciver",
      transactionFrom: "crash",
      transactionType: "bet",
      transactionAsset: "SOL",
      transactionAmount: amount,
      transactionHash,
      gameId,
      referenceId: newBet._id,
      status: "completed",
      isFromInstaWallet: userDetails?.instawalletEnable,
    });

    //publisher for userService
    const pubData = {
      userID: userDetails._id,
      updateData: {
        $inc: {
          totalWageredAmount: amount,
          xpMarker: gameConfigData.xpPerBet,
        },
      },
    };

    await UserSchema.findOneAndUpdate(
      { _id: pubData.userID },
      pubData.updateData,
    );

    // await redisPubliser("User:Update", pubData);

    await GameSessionModel.findByIdAndUpdate(
      gameId,
      {
        $inc: {
          totalBetAmount: amountLamports,
          totalBetAmountUi: amount,
          totalSolCollected: amount, // increment total SOL collected
          totalPlayers: 1, // increment number of players
        },
      },
      { new: true },
    );

    // Balance was already reserved atomically above (BS-GAME-005 fix); no
    // second debit here.

    return { status: true, data: [], userID: userDetails._id };
  } catch (err) {
    console.error("[placegameBet__error]", err);
    return {
      status: false,
      message: "Internal server error while placing bet",
      data: [],
      userID: data?.userDetails?._id,
    };
  }
};

export const performCashout = async ({
  userDetails,
  gameId,
  currentBetTime,
  progressCashOutPercentage,
}) => {
  try {
    let gameConfigData = await gameConfig.findOne({
      gameType: "crash",
    });

    if (
      !userDetails?._id ||
      !gameId ||
      !progressCashOutPercentage ||
      !currentBetTime
    ) {
      return {
        status: false,
        message: "Invalid or missing parameters for cashout",
        userID: userDetails._id,
      };
    }

    const requestTime = new Date(currentBetTime);
    if (isNaN(requestTime.getTime())) {
      return {
        status: false,
        message: "Invalid currentBetTime format",
        userID: userDetails._id,
      };
    }

    const gameDetails = await GameSessionModel.findById(gameId);
    if (!gameDetails) {
      return {
        status: false,
        message: "Game not found",
        userID: userDetails._id,
      };
    }

    const now = new Date();
    const allowedBettingTill = new Date(gameDetails.allowedBettingTill);
    const gameEndTime = new Date(gameDetails.endTime);
    const cashoutStartAt = new Date(gameDetails.cashoutStartAt);
    //cashout timing
    if (requestTime < allowedBettingTill || requestTime < cashoutStartAt) {
      return {
        status: false,
        message: "Cannot cashout before betting window closes",
        userID: userDetails._id,
      };
    }
    if (requestTime >= gameEndTime) {
      return {
        status: false,
        message: "Cannot cashout after game ended",
        userID: userDetails._id,
      };
    }

    //multiplier is valid
    // Get max multiplier from game result (string → number)
    const maxMultiplier = Number(gameDetails.result); // example: 5.5
    console.log(
      "🚀 ~ performCashout ~ maxMultiplier:",
      maxMultiplier,
      typeof maxMultiplier,
    );

    // Total crash time is always 5.5 seconds
    const TOTAL_CRASH_DURATION = 5500; // in ms

    // Get time passed after crash started
    const elapsedMs = now - cashoutStartAt;

    // Compute multiplier based on 5.5 second ramp
    let multiplier = 1 + elapsedMs / TOTAL_CRASH_DURATION;
    console.log(
      "🚀 ~ performCashout ~ multiplier:",
      multiplier,
      typeof multiplier,
    );
    console.log("multiplier < 1-->", multiplier < 1);
    console.log("multiplier > maxMultiplier-->", multiplier > maxMultiplier);
    // clamp betwconsole.log('-->',)een 1x and max multiplier
    if (multiplier < 1) multiplier = 1;
    if (multiplier > maxMultiplier) multiplier = maxMultiplier;

    multiplier = Number(multiplier.toFixed(4));
    console.log("🚀 ~ performCashout ~ multiplier:", multiplier);

    console.log("Current Multiplier:", multiplier, "Max:", maxMultiplier);

    console.log("currentMultiper", multiplier, gameDetails.result);
    if (multiplier <= 0) {
      return { status: false, message: `game has ended` };
    }

    if (multiplier > maxMultiplier) {
      return {
        status: false,
        message: `Multiplier exceeds game's max multiplier (${maxMultiplier}x)`,
        userID: userDetails._id,
      };
    }

    const activeBet = await BetModel.findOne({
      userId: userDetails._id,
      gameId,
      gameStatus: "in-play",
    });
    console.log(activeBet);
    if (!activeBet) {
      return {
        status: false,
        message: "No active bet found for this game",
        userID: userDetails._id,
      };
    }

    const inPlay = activeBet.inPlayamountUI;
    console.log("🚀 ~ performCashout ~ inPlay:", inPlay);
    const percentage = progressCashOutPercentage || 100; // progressCashOutPercentage ? (progressCashOutPercentage / 100) : 100;
    console.log("🚀 ~ performCashout ~ percentage:", percentage);
    const cashoutPortion = (inPlay * percentage) / 100;
    console.log("🚀 ~ performCashout ~ cashoutPortion:", cashoutPortion);
    const cashoutTotal = Number((cashoutPortion * multiplier).toFixed(6));
    console.log("🚀 ~ performCashout ~ cashoutTotal:", cashoutTotal);
    const remainingSOL = Number((inPlay - cashoutPortion).toFixed(6));

    activeBet.inPlayamount = toLamports(remainingSOL);
    activeBet.inPlayamountUI = remainingSOL;

    const profitMade = cashoutTotal - cashoutPortion;
    activeBet.profitamount += toLamports(profitMade);
    activeBet.profitamountUI += profitMade;

    if (remainingSOL <= 0) activeBet.gameStatus = "cashed";

    activeBet.result = multiplier.toString();
    activeBet.profitLossAmount += profitMade;
    await activeBet.save();
    console.log("perform", cashoutTotal, profitMade);

    let [vault] = await solanaManager.getVaultPda("crash");
    await TransactionModel.create({
      userId: userDetails._id,
      fromAddress: new PublicKey(vault).toString() || "PlatformWallet",
      toAddress: userDetails.walletAddress,
      transactionFrom: "crash",
      transactionType: remainingSOL <= 0 ? "cashout" : "partialCashout",
      transactionAsset: "SOL",
      progressCashOutPercentage: progressCashOutPercentage,
      transactionAmount: cashoutTotal,
      transactionHash: "",
      gameId: gameId,
      referenceId: activeBet._id,
      status: "pending",
      isFromInstaWallet: activeBet.isFromInstaWallet,
      result: multiplier.toString(),
    });

    //publisher for userService
    const updateData = { $inc: { netProfit: profitMade } };

    if (remainingSOL <= 0 && profitMade > 0) {
      updateData.$inc.xpMarker = gameConfigData.xpForWinners;
    }

    await UserSchema.findOneAndUpdate({ _id: userDetails._id }, updateData);

    return {
      status: true,
      message: `cashedOut successfully at ${multiplier}`,
      userID: userDetails._id,
    };
  } catch (err) {
    console.error("[performCashout__error]", err);
    return {
      status: false,
      message: "Internal server error during cashout",
      userID: userDetails._id,
    };
  }
};

export const performAutoCashout = async (currentMultiplier, gameId) => {
  try {
    if (!currentMultiplier || currentMultiplier < 1) return;

    const autoBets = await BetModel.find({
      gameId,
      gameStatus: "in-play",
      autoCashOut: { $gt: 0, $lte: currentMultiplier },
    });

    const gamesession = await GameSessionModel.findOne({ _id: gameId });

    if (!gamesession) return;

    if (currentMultiplier > gamesession.result) return;

    if (autoBets.length === 0) return;

    for (const bet of autoBets) {
      const { userId, inPlayamount, autoCashOut, inPlayamountUI } = bet;
      console.log(
        "🚀 ~ performAutoCashout ~ userId, inPlayamount, autoCashOut, inPlayamountUI:",
        userId,
        inPlayamount,
        autoCashOut,
        inPlayamountUI,
      );

      if (autoCashOut > 0) {
        const cashoutAmount = inPlayamountUI * autoCashOut;
        console.log("🚀 ~ performAutoCashout ~ cashoutAmount:", cashoutAmount);
        const profit = cashoutAmount - inPlayamountUI;

        bet.gameStatus = "cashed";
        bet.profitLossAmount = profit;
        bet.profitamount = toLamports(cashoutAmount);
        bet.profitamountUI = cashoutAmount;
        await bet.save();

        const user = await UserSchema.findById({ _id: bet.userId });

        let [vault] = await solanaManager.getVaultPda("crash");
        await TransactionModel.create({
          userId,
          fromAddress: new PublicKey(vault).toString() || "PlatformWallet",
          toAddress: user.walletAddress,
          transactionFrom: "crash",
          transactionType: "cashout",
          transactionAsset: "SOL",
          transactionAmount: cashoutAmount,
          transactionHash: "",
          referenceId: bet._id,
          gameId: gameId,
          status: "pending",
          isFromInstaWallet: bet.isFromInstaWallet,
          result: autoCashOut.toString(),
        });

        await UserSchema.findByIdAndUpdate(userId, {
          $inc: {
            netProfit: profit,
            // totalWageredAmount: inPlayamountUI,
          },
        });

        await crashPubliser("crash:user:notification", {
          status: true,
          userId,
          data: {
            betId: bet._id,
            multiplier: autoCashOut,
            cashoutAmount,
            profit,
          },
        });
        const liveData = await fetchOnLiveGameData();
        await crashPubliser("crash:game:update", liveData);
      }
    }
  } catch (err) {
    console.error("[performAutoCashout] Error:", err.message);
  }
};

export const cashoutgameBet = async (data) => {
  const { userDetails, gameId, currentBetTime, progressCashOutPercentage } =
    data;
  if (
    !userDetails?._id ||
    !gameId ||
    !progressCashOutPercentage ||
    !currentBetTime
  )
    return { status: false, message: "Invalid cashout payload" };

  return performCashout({
    userDetails,
    gameId,
    currentBetTime,
    progressCashOutPercentage,
  });
};
