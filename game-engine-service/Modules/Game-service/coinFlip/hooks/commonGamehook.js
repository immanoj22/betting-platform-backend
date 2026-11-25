import gameSession from "../../gamemodel/gameSession.js";
import NewGameModel from "../../gamemodel/gameModel.js";
import { v4 as uuidv4 } from "uuid";
import { getGameHash } from "../../../../library/multiplierlibrary";
import crypto from "crypto";
import BetModel from "../../gamemodel/BetSchema.js";
import mongoose from "mongoose";
import {
  publicSeedGeneration,
  serverSeedGeneration,
} from "../../../../library/seedGenratorlibrary.js";
import { getOrUpdateLiveGameData } from "../../crashGame/hooks/commonGamehook.js";
import solanaManager from "../../../../service/solanaManager.js";

export const newGameSession = async (type, resultForGame) => {
  try {
    const gameConfig = await gameSession.create({
      gameType: type,
      result: resultForGame,
      ...(type != "crash" ? { status: "initiate" } : {}),
    });

    if (type === "crash") {
      gameConfig.endTime = calculateEndingTime(
        gameConfig.cashoutStartAt,
        resultForGame,
      );
      await gameConfig.save();
    }

    return gameConfig;
  } catch (err) {
    console.error("Error creating new game:", err);
    throw err;
  }
};

export async function fetchOnLiveGameData() {
  try {
    let crashGames = await gameSession
      .find({ gameType: "coinFlip" })
      .sort({ createdAt: -1 })
      .limit(1);
    if (!crashGames || crashGames.length === 0) {
      return null;
    }
    crashGames = crashGames[0];
    return await getOrUpdateLiveGameData(crashGames._id);
  } catch (err) {
    console.error("[fetchOnLiveGameData] Error:", err.message);
    throw err;
  }
}

export const createNewCoinFlipGame = async (type) => {
  try {
    const coinflipData = await newCoinFlip();

    const roundId = await generateUniqueGameId();
    const serverSeed = coinflipData.serverSeed;
    const publicSeed = coinflipData.publicSeed;

    const hashedServerSeed = crypto
      .createHash("sha256")
      .update(serverSeed)
      .digest("hex");

    const gamesession = await newGameSession(type, coinflipData.coinflipResult);

    const newCoinFlipGame = await NewGameModel.create({
      gamesession: gamesession._id,
      gameId: roundId,
      serverSeed,
      publicSeed,
      startGameHash: "",
      hashedServerSeed,
    });

    // await solanaManager.gameCreate({
    //     gameType: "flip",
    //     publicSeed: publicSeed,
    //     hashedServerSeed: hashedServerSeed,
    //     roundId: String(gamesession._id),
    // });

    return { status: true, data: newCoinFlipGame };
  } catch (err) {
    console.error("Error creating new coin game:", err);
    return {
      status: false,
      error: err.message,
      message: "error happened while creating bet",
    };
  }
};

export const flipGameDetails = async (gameId) => {
  try {
    const result = await gameSession.aggregate([
      // 1: MATCH GAME SESSION
      {
        $match: { _id: new mongoose.Types.ObjectId(gameId) },
      },

      // 2: NEW GAME DETAILS
      {
        $lookup: {
          from: "newgames",
          localField: "_id",
          foreignField: "gamesession",
          as: "gameDetails",
        },
      },

      // 3: LOAD BETS
      {
        $lookup: {
          from: "bets",
          localField: "_id",
          foreignField: "gameId",
          as: "bettingDetails",
        },
      },

      // 4: LOAD USERS
      {
        $lookup: {
          from: "users",
          localField: "bettingDetails.userId",
          foreignField: "_id",
          as: "betUsers",
        },
      },

      // 5: MAP bets + attach FULL USER OBJECT in "betterDetails"
      {
        $addFields: {
          bettingDetails: {
            $map: {
              input: "$bettingDetails",
              as: "bet",
              in: {
                $mergeObjects: [
                  "$$bet",
                  {
                    betterDetails: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$betUsers",
                            as: "usr",
                            cond: { $eq: ["$$usr._id", "$$bet.userId"] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },

      // 6: REMOVE betUsers ONLY
      {
        $unset: "betUsers",
      },
    ]);

    if (!result?.length) {
      return {
        status: false,
        message: "Game not found",
        data: null,
      };
    }

    return {
      status: true,
      message: "Coin flip game details fetched",
      userId: result[0]?.bettingDetails?.[0]?.betterDetails?._id || null,
      data: result[0],
    };
  } catch (err) {
    console.error("flipGameDetails error:", err);
    return {
      status: false,
      message: err.message,
    };
  }
};

export const newCoinFlip = async () => {
  const uniquId = uuidv4();
  const serverSeed = await serverSeedGeneration();
  const publicSeed = await publicSeedGeneration();
  const gameHash = await getGameHash(serverSeed, publicSeed);
  const parsedNumber = parseInt(gameHash.slice(0, 16), 16);
  const coinflipResult = parsedNumber % 1_000_000;
  const winnerSide = coinflipResult < 500_000 ? "LOW" : "HIGH";
  return {
    serverSeed,
    publicSeed,
    coinflipResult,
    winnerSide,
    gameHash,
    uniquId,
  };
};

async function generateUniqueGameId() {
  let id;
  let exists = true;

  while (exists) {
    id = uuidv4();
    exists = await NewGameModel.exists({ gameId: id });
  }

  return id;
}
