import mongoose from "mongoose";
import BetModel from "../../gamemodel/BetSchema";
import TransactionModel from "../../gamemodel/TransactionSChema";
import solanaManager from "../../../../service/solanaManager";
import GameSessionModel from "../../gamemodel/gameSession";
import NewGameModel from "../../gamemodel/gameModel";
import { createNewCoinFlipGame, flipGameDetails } from "./commonGamehook";
import { coinPubliser } from "../redis pub-sub/coinflip/coinFlippubliser/coinFlipPublisher";
import { redisPubliser } from "../../../../service/redis/publisers/redisPublisers";
import { getUserDetailsViaPubSub } from "../../../../helper/getPubSubDetails";

import UserSchema from "../../comonModel/UserSchema";
import gameConfig from "../../comonModel/gameConfig";
import { PublicKey } from "@solana/web3.js";

const toLamports = (sol) => (isNaN(sol) ? 0 : Math.floor(sol * 1e9));
const fromLamports = (lamports) => (isNaN(lamports) ? 0 : lamports / 1e9);

export const placeNewCoinFlipGame = async (payload) => {
  try {
    const userID = payload.userDetails._id;

    let result = await placecoinFlipBet({
      userDetails: payload.userDetails,
      gameId: payload.gameId,
      amount: payload.amount,
      side: payload.side,
      transactionHash: payload.transactionHash,
    });
    result.userId = userID;
    return result;
  } catch (err) {
    console.log("__placeNewCoinFlipGame err", err.message);
    return { status: false, error: err.message };
  }
};

export const placecoinFlipBet = async (data) => {
  try {
    let { userDetails, gameId, amount, side, transactionHash } = data;
    let gameConfigData = await gameConfig.findOne({
      gameType: "coinflip",
    });
    if (!gameConfigData) {
      return { status: false, message: " coinflip config data is found" };
    } else if (!gameConfigData.isEnabled) {
      return { status: false, message: "game has stoped for temporarly" };
    }

    if (!userDetails?._id || !amount || !side || !gameId) {
      return {
        status: false,
        message: "Missing required fields",
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
      };
    }
    if (amount < gameConfigData.minBetAmount) {
      return {
        status: false,
        message: `minimum bet amount should be ${gameConfigData.minBetAmount}`,
      };
    }
    if (amount > gameConfigData.maxBetAmount) {
      return {
        status: false,
        message: `maximum bet amount should be ${gameConfigData.minBetAmount}`,
      };
    }

    if (
      userDetails?.instawalletEnable &&
      userDetails?.instawalletbalance < amount
    ) {
      return {
        status: false,
        message: "Insufficient Balance In Insta Wallet",
        userID: userDetails._id,
      };
    }

    const gameDetails = await GameSessionModel.findOne({ _id: gameId });
    console.log("🚀 ~ placecoinFlipBet ~ gameDetails:", gameDetails);
    if (!gameDetails) {
      return { status: false, message: "Coin flip game not found" };
    }

    const existingBet = await BetModel.findOne({
      userId: userDetails._id,
      gameId,
      gameStatus: "in-play",
    });
    console.log("🚀 ~ placecoinFlipBet ~ existingBet:", existingBet);

    if (existingBet) {
      return {
        status: false,
        message: "You already placed a bet in this game",
      };
    }

    if (userDetails?.instawalletEnable) {
      transactionHash = await solanaManager.createOrJoinBet(
        gameId,
        side == "LOW" ? 2 : 1,
        amount,
      );
      console.log("🚀 ~ placecoinFlipBet ~ transactionHash:", transactionHash);
      if (transactionHash?.status) {
        transactionHash = transactionHash?.txHash;
      } else {
        return {
          status: false,
          message: "Something went Wrong. Please try again",
        };
      }
    }

    if (!userDetails.instawalletEnable) {
      // BS-GAME-009 fix: pass this game's actual vault as the expected
      // deposit destination (previously unchecked).
      const [flipVault] = await solanaManager.getVaultPda("flip");
      let txVerify = await solanaManager.verifyTransaction(
        transactionHash,
        userDetails.instawalletEnable
          ? process.env.INSTA_ACCOUNT
          : userDetails.walletAddress,
        amount,
        flipVault,
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

    const bet = await BetModel.create({
      userId: userDetails._id,
      gameId,
      betamount: toLamports(amount),
      betamountUI: amount,

      inPlayamount: toLamports(amount),
      inPlayamountUI: amount,

      profitamount: 0,
      profitamountUI: 0,

      transactionHash,
      side,

      gameStatus: "in-play",
      isFromInstaWallet: userDetails?.instawalletEnable,
      profitLossAmount: 0,
    });
    console.log("🚀 ~ placecoinFlipBet ~ bet:", bet);

    let [vault] = await solanaManager.getVaultPda("flip");
    await TransactionModel.create({
      userId: userDetails._id,
      fromAddress: userDetails.walletAddress,
      toAddress: new PublicKey(vault).toString() || "to_add",
      result: side,
      transactionFrom: "coinFlip",
      transactionType: "coinFlip-bet",
      transactionAsset: "SOL",
      transactionAmount: amount,
      transactionHash,
      gameId,
      referenceId: bet._id,
      isFromInstaWallet: userDetails?.instawalletEnable,
      status: "completed",
    });

    // -------------------------
    // 8. UPDATE USER TOTAL WAGER
    // -------------------------
    // await redisPubliser("User:Update", data)
    await UserSchema.findByIdAndUpdate(userDetails._id, {
      $inc: { totalWageredAmount: amount, xpMarker: gameConfigData.xpPerBet },
    });

    if (userDetails?.instawalletEnable) {
      await UserSchema.findOneAndUpdate(
        { _id: userDetails._id },
        {
          $inc: {
            instawalletbalance: -Number(amount),
          },
        },
        { new: true },
      );
    }

    // // -------------------------
    // // 9. UPDATE GAME STATS LIKE CRASH
    // // -------------------------
    const updateGamesessions = await GameSessionModel.findOneAndUpdate(
      { _id: gameId },
      {
        status: "creating-onchain",
        $inc: {
          totalBetAmountUi: amount,
          totalBetAmount: toLamports(amount),
          totalPlayers: 1,
        },
      },
      { new: true },
    );

    const NewGame = await NewGameModel.findOne(
      { gamesession: gameId }, // FIXED
    );

    return {
      status: true,
      message: "Coin flip bet placed",
      NewGame,
      userId: userDetails?._id,
    };
  } catch (err) {
    console.log("__placecoinFlipBet error:", err.message);
    return { status: false, error: err.message };
  }
};

export const placeOppositeCoinFlipBet = async (data) => {
  try {
    let { userDetails, gameId, amount, side, transactionHash } = data;
    console.log("sfsf", userDetails, gameId, amount, side, transactionHash);

    if (!userDetails?._id || !amount || !gameId || !side) {
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

    if (
      userDetails?.instawalletEnable &&
      userDetails?.instawalletbalance < amount
    ) {
      return {
        status: false,
        message: "Insufficient Balance In Insta Wallet",
        userID: userDetails._id,
      };
    }

    if (userDetails?.instawalletEnable) {
      transactionHash = await solanaManager.createOrJoinBet(
        gameId,
        side == "LOW" ? 2 : 1,
        amount,
        true,
      );
      if (transactionHash?.status) {
        transactionHash = transactionHash?.txHash;
      } else {
        return {
          status: false,
          message: "Something went Wrong. Please try again",
          userID: userDetails._id,
        };
      }
    }

    if (!userDetails.instawalletEnable) {
      // BS-GAME-009 fix: pass this game's actual vault as the expected
      // deposit destination (previously unchecked).
      const [flipVault] = await solanaManager.getVaultPda("flip");
      let txVerify = await solanaManager.verifyTransaction(
        transactionHash,
        userDetails.instawalletEnable
          ? process.env.INSTA_ACCOUNT
          : userDetails.walletAddress,
        amount,
        flipVault,
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

    const game = await GameSessionModel.findById(gameId);
    if (!game) return { status: false, message: "Game not found" };

    const existingBets = await BetModel.find({ gameId });
    if (existingBets.length === 0)
      return { status: false, message: "No main  yet. Wait for Player 1." };

    const firstBet = existingBets[0];

    if (String(firstBet.userId) === String(userDetails._id)) {
      return { status: false, message: "You cannot bet against yourself." };
    }

    if (existingBets.length >= 2) {
      return {
        status: false,
        refunded: true,
        message: "Game already has 2 players.",
      };
    }

    if (firstBet.side === side)
      return {
        status: false,
        message: "Side already taken. Choose opposite side.",
      };

    const amountLamports = toLamports(amount);

    const bet = await BetModel.create({
      userId: userDetails._id,
      gameId,
      betamount: amountLamports,
      betamountUI: amount,
      inPlayamount: amountLamports,
      inPlayamountUI: amount,
      profitamount: 0,
      profitamountUI: 0,
      transactionHash,
      side,
      gameStatus: "in-play",
      isFromInstaWallet: userDetails?.instawalletEnable,
      profitLossAmount: 0,
    });

    let [vault] = await solanaManager.getVaultPda("flip");
    await TransactionModel.create({
      userId: userDetails._id,
      fromAddress: userDetails.walletAddress,
      toAddress: new PublicKey(vault).toString() || "to_add",
      result: side,
      transactionFrom: "coinFlip",
      transactionType: "coinFlip-bet",
      transactionAsset: "SOL",
      transactionAmount: amount,
      transactionHash,
      gameId,
      referenceId: bet._id,
      isFromInstaWallet: userDetails?.instawalletEnable,
      status: "completed",
    });

    // 8. Update user total wager
    let gameConfigData = await gameConfig.findOne({
      gameType: "coinflip",
    });
    // await redisPubliser("User:Update", data)
    await UserSchema.findByIdAndUpdate(userDetails._id, {
      $inc: { totalWageredAmount: amount, xpMarker: gameConfigData.xpPerBet },
    });

    if (userDetails?.instawalletEnable) {
      await UserSchema.findOneAndUpdate(
        { _id: userDetails._id },
        {
          $inc: {
            instawalletbalance: -Number(amount),
          },
        },
        { new: true },
      );
    }

    // 9. Update game session totals
    const updatedGame = await GameSessionModel.findByIdAndUpdate(
      gameId,
      {
        totalPlayers: 2,
        status: "in-progress",
        endTime: new Date(Date.now() + 5000),
        $inc: {
          totalBetAmount: amountLamports,
          totalBetAmountUi: amount,
          totalSolCollected: amountLamports,
        },
      },
      { new: true },
    );

    const newCoinFlipGame = await NewGameModel.findOne({
      gamesession: updatedGame._id,
    }).lean();

    await solanaManager.gameCreate({
      gameType: "flip",
      publicSeed: newCoinFlipGame?.publicSeed,
      hashedServerSeed: newCoinFlipGame?.hashedServerSeed,
      roundId: String(updatedGame._id),
    });

    const fetchedDetails = await flipGameDetails(gameId);
    await coinPubliser("coinFlip:user:notification", fetchedDetails);
    await coinPubliser("coinFlip:game:update", fetchedDetails);

    await settimeout(8000);
    await resolveCoinFlipGame(gameId);
    const fetchedfinishedDetails = await flipGameDetails(gameId);
    await coinPubliser("coinFlip:game:update", fetchedfinishedDetails);
    return;
  } catch (err) {
    console.error("placeOppositeCoinFlipBet error:", err);
    return { status: false, error: err.message };
  }
};

const settimeout = (ms) => {
  return new Promise((resolve) =>
    setTimeout(() => {
      resolve();
    }, ms),
  );
};

export const placeOppositeBotCoinFlipBet = async ({
  userDetails,
  gameId,
  amount,
  side,
}) => {
  try {
    console.log("placeOppositeBotCoinFlipBet-->", {
      userDetails,
      gameId,
      amount,
      side,
    });
    const game = await GameSessionModel.findById(gameId);
    if (!game) return { status: false, message: "Game not found" };

    const existingBets = await BetModel.find({ gameId });
    if (existingBets.length === 0)
      return {
        status: false,
        message: "No main bet placed yet. Wait for Player 1.",
      };

    const firstBet = existingBets[0];

    if (String(firstBet.userId) === String(userDetails._id)) {
      return { status: false, message: "Bot cannot bet against itself." };
    }

    if (existingBets.length >= 2) {
      return {
        status: false,
        refunded: true,
        message: "Game already has 2 players.",
      };
    }
    console.log("firstBet.side-->", firstBet.side, "side-->", side);
    if (firstBet.side === side) {
      side = firstBet.side === "HIGH" ? "LOW" : "HIGH";
    }

    let transactionHash = await solanaManager.createOrJoinBet(
      gameId,
      side == "LOW" ? 2 : 1,
      amount,
      true,
      true,
    );
    if (transactionHash?.status) {
      transactionHash = transactionHash?.txHash;
    } else {
      return {
        status: false,
        message: "Something went Wrong. Please try again later",
      };
    }

    const amountLamports = toLamports(amount);

    const bet = await BetModel.create({
      userId: userDetails._id,
      gameId,
      betamount: amountLamports,
      betamountUI: amount,
      inPlayamount: amountLamports,
      inPlayamountUI: amount,
      profitamount: 0,
      profitamountUI: 0,
      transactionHash: transactionHash,
      side,
      coinFlipgamestatus: "in-play",
      profitLoss: "pending",
      profitLossAmount: 0,
    });

    let [vault] = await solanaManager.getVaultPda("flip");
    await TransactionModel.create({
      userId: userDetails._id,
      fromAddress: userDetails.walletAddress,
      toAddress: new PublicKey(vault).toString() || "to_add",
      result: side,
      transactionFrom: "coinFlip",
      transactionType: "coinFlip-bet",
      transactionAsset: "SOL",
      transactionAmount: amount,
      transactionHash,
      gameId,
      referenceId: bet._id,
      isFromInstaWallet: userDetails?.instawalletEnable,
      status: "completed",
    });

    const data = {
      userID: userDetails._id,
      updateData: { $inc: { totalWageredAmount: amountLamports } },
    };
    // await redisPubliser("User:Update", data)
    await UserSchema.findByIdAndUpdate(userDetails._id, {
      $inc: { totalWageredAmount: amount },
    });

    const updatedGame = await GameSessionModel.findByIdAndUpdate(
      gameId,
      {
        totalPlayers: 2,
        status: "in-progress",
        endTime: new Date(Date.now() + 5000),
        $inc: {
          totalBetAmount: amountLamports,
          totalBetAmountUi: amount,
          totalSolCollected: amountLamports,
        },
      },
      { new: true },
    );

    const fetchedDetails = await flipGameDetails(gameId);
    await coinPubliser("coinFlip:user:notification", fetchedDetails);
    await coinPubliser("coinFlip:game:update", fetchedDetails);

    await settimeout(8000);
    await resolveCoinFlipGame(gameId);
    const fetchedfinishedDetails = await flipGameDetails(gameId);
    await coinPubliser("coinFlip:game:update", fetchedfinishedDetails);
  } catch (err) {
    console.error("placeOppositeBotCoinFlipBet error:", err);
    return { status: false, error: err.message };
  }
};

const resolveCoinFlipGame = async (gameId) => {
  try {
    const game = await GameSessionModel.findById(gameId);
    console.log("🚀 ~ resolveCoinFlipGame ~ game:", game, gameId);
    if (!game) return { error: "Game not found" };

    const bets = await BetModel.find({ gameId });
    console.log("🚀 ~ resolveCoinFlipGame ~ bets:", bets);
    if (bets.length < 2) return { error: "Not enough players" };

    const result = game.result < 500_000 ? "LOW" : "HIGH";
    console.log("🚀 ~ resolveCoinFlipGame ~ result:", result);
    game.status = "finished";

    await game.save();

    const gameConfigData = await gameConfig.findOne({ gameType: "coinflip" });

    console.log("bets-->", bets);
    const betResults = await Promise.all(
      bets.map(async (bet) => {
        console.log("🚀 ~ resolveCoinFlipGame ~ bet:", bet, gameId);
        const userWon = bet.side === result;
        console.log("🚀 ~ resolveCoinFlipGame ~ userWon:", userWon);
        const betAmountUI = fromLamports(bet.betamount);

        // Profit/Loss Calculation
        const profitUI = userWon ? betAmountUI : -betAmountUI;
        console.log("lamportisue", profitUI, betAmountUI, -betAmountUI);
        bet.gameStatus = userWon ? "cashed" : "busted";
        bet.profitLossAmount = profitUI;
        await bet.save();

        // Update User Stats
        const userUpdate = {
          $inc: {
            netProfit: profitUI, // winner:+profit, loser:-loss
          },
        };

        // Add XP only for winners
        if (userWon) {
          userUpdate.$inc.xpMarker = gameConfigData.xpForWinners;
        }

        const user = await UserSchema.findByIdAndUpdate(
          bet.userId,
          userUpdate,
          { new: true },
        );

        console.log(
          "sssss-->",
          bet?.gameId,
          result == "LOW" ? 2 : 1,
          user.walletAddress,
        );

        if (userWon) {
          flipCashoutFunction(bet, result, user, betAmountUI);
        }

        return {
          userId: bet.userId,
          side: bet.side,
          betAmount: betAmountUI,
          profitLoss: profitUI,
          status: bet.gameStatus,
        };
      }),
    );
    let newGameData = await NewGameModel.findOne(
      { gamesession: game?._id }, // FIXED
    ).lean();
    console.log("🚀 ~ resolveCoinFlipGame ~ newGameData:", newGameData);
    solanaManager.gameFinish({
      gameType: "flip",
      roundId: String(game._id),
      serverSeed: newGameData?.serverSeed,
      result: game?.result,
    });
    return { result, bets: betResults };
  } catch (err) {
    console.log("_resolveCoinFlipGame_error:", err);
    return { error: err.message };
  }
};

const flipCashoutFunction = async (bet, result, user, betAmountUI) => {
  console.log("🚀 ~ flipCashoutFunction ~ user:", user);
  let txHash;
  txHash = await solanaManager.flipCashout(
    bet?.gameId,
    result == "LOW" ? 2 : 1,
    bet?.isFromInstaWallet ? process.env.INSTA_ACCOUNT : user.walletAddress,
  );

  console.log("🚀 ~ flipCashoutFunction ~ txHash:", txHash);

  const [vault] = await solanaManager.getVaultPda("flip");

  // Transaction only if win
  await TransactionModel.create({
    userId: bet.userId,
    fromAddress: new PublicKey(vault).toString() || "platform",
    toAddress: user.walletAddress,
    result: bet.side,
    transactionFrom: "coinflip",
    transactionType: "cashout",
    transactionAsset: "SOL",
    transactionAmount: betAmountUI * 2, // payout includes original stake
    transactionHash: txHash?.txhash,
    gameId: bet?.gameId,
    referenceId: bet._id,
    isFromInstaWallet: bet?.isFromInstaWallet,
    status: txHash?.status ? "completed" : "pending",
  });

  if (user.role != "bot" && bet.isFromInstaWallet) {
    await UserSchema.findOneAndUpdate(
      { walletAddress: user.walletAddress },
      {
        $inc: {
          instawalletbalance: betAmountUI * 2, // winner:+profit, loser:-loss
        },
      },
    );
  }
};
