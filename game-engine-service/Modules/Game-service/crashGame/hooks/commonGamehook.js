import gameSession from "../../gamemodel/gameSession.js";
import NewGameModel from "../../gamemodel/gameModel.js";
import { v4 as uuidv4 } from "uuid";
import {
  getGameHash,
  multiplierCalculator,
} from "../../../../library/multiplierlibrary";
import {
  publicSeedGeneration,
  serverSeedGeneration,
} from "../../../../library/seedGenratorlibrary";
import crypto from "crypto";
import BetModel from "../../gamemodel/BetSchema.js";
import TransactionModel from "../../gamemodel/TransactionSChema.js";
import mongoose from "mongoose";
import gameConfig from "../../comonModel/gameConfig.js";
import solanaManager from "../../../../service/solanaManager.js";

/** ------------------------------
 *  Create a new game session
 *  ----------------------------- */
export const newGameSession = async (type, resultForGame) => {
  try {
    const gameConfig = await gameSession.create({
      gameType: type,
      result: resultForGame,
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

/** Calculate ending time for crash game */
// export const calculateEndingTime = (cashoutStartAt, resultForGame) => {
//     try {
//         const cashoutDate = new Date(cashoutStartAt);

//         // Duration in seconds
//         const totalSeconds = resultForGame * 1.5;

//         return new Date(cashoutDate.getTime() + totalSeconds * 1000);
//     } catch (err) {
//         console.error("Error calculating ending time:", err);
//         return new Date(cashoutStartAt);
//     }
// };

export const calculateEndingTime = (cashoutStartAt, resultForGame) => {
  try {
    const cashoutDate = new Date(cashoutStartAt);

    const durationMs = (Number(resultForGame) - 1) * 5500;
    console.log("resulttttCalculateEndingTime", resultForGame, durationMs);
    return new Date(cashoutDate.getTime() + durationMs);
  } catch (err) {
    console.error("Error calculating ending time:", err);
    return new Date(cashoutStartAt);
  }
};

/** Update crash game details */
export const updateCrashGame = async (id, updateData) => {
  try {
    const updatedGame = await NewGameModel.findOneAndUpdate(
      { _id: id },
      updateData,
      { new: true },
    );
    return !!updatedGame;
  } catch (error) {
    console.error("Error updating crash game:", error);
    throw error;
  }
};

/** Save or update crash bet */
export const saveOrUpdateCrashBet = async (data) => {
  try {
    const {
      userId,
      gameId,
      amount = 0,
      transactionHash = "",
      cashOut = 0,
      progressCashOut = 0,
      profitLossAmount = 0,
    } = data;

    if (!userId || !gameId)
      return { status: false, error: "userId and gameId are required" };

    const bet = await BetModel.findOneAndUpdate(
      { userId, gameId },
      {
        $set: {
          amount,
          transactionHash,
          cashOut,
          progressCashOut,
          profitLossAmount,
        },
      },
      { new: true, upsert: true },
    );

    console.log(
      `Crash bet ${
        bet ? "updated" : "created"
      } for user ${userId} in game ${gameId}`,
    );
    return { status: true, data: bet };
  } catch (err) {
    console.error("Error saving/updating crash bet:", err);
    return { status: false, error: err.message };
  }
};

/** Create or update a transaction */
export const createOrUpdateTransaction = async (txData) => {
  try {
    const {
      userId,
      fromAddress,
      toAddress,
      transactionType,
      transactionAsset,
      transactionAmount,
      transactionHash,
      referenceId = null,
      status = "pending",
    } = txData;

    if (
      !userId ||
      !fromAddress ||
      !toAddress ||
      !transactionType ||
      !transactionAsset ||
      !transactionAmount ||
      !transactionHash
    ) {
      return { status: false, error: "Missing required transaction fields" };
    }

    const transaction = await TransactionModel.findOneAndUpdate(
      { transactionHash },
      {
        $set: {
          userId,
          fromAddress,
          toAddress,
          transactionType,
          transactionAsset,
          transactionAmount,
          referenceId,
          status,
        },
      },
      { new: true, upsert: true },
    );

    console.log("Transaction created/updated:", transaction._id);
    return { status: true, data: transaction };
  } catch (error) {
    console.error("Error in createOrUpdateTransaction:", error);
    return { status: false, error: error.message };
  }
};

/** Clear unfinished or stuck crash rounds */
export const clearUnfinishedRounds = async () => {
  try {
    const result = await gameSession.updateMany(
      { status: { $ne: "finished" } },
      { $set: { status: "finished", endedAt: new Date() } },
    );

    console.log(`Cleared ${result.modifiedCount} unfinished crash rounds`);
    return result;
  } catch (err) {
    console.error("Error clearing unfinished rounds:", err);
    throw err;
  }
};

/** Get or update live game data */
export async function getOrUpdateLiveGameData(id, status) {
  try {
    const objectId = new mongoose.Types.ObjectId(id);

    // Optional status update
    if (status) {
      await gameSession.findByIdAndUpdate(objectId, { status });
    }

    const [crashLiveGameData] = await gameSession.aggregate([
      { $match: { _id: objectId } },

      // Game details
      {
        $lookup: {
          from: "newgames",
          localField: "_id",
          foreignField: "gamesession",
          as: "gamedetails",
        },
      },
      { $unwind: { path: "$gamedetails", preserveNullAndEmptyArrays: true } },

      // Fetch all bets
      {
        $lookup: {
          from: "bets",
          localField: "_id",
          foreignField: "gameId",
          as: "bets",
        },
      },

      // Attach userDetails for bets
      {
        $lookup: {
          from: "users",
          let: { userId: "$bets.userId" },
          pipeline: [
            { $match: { $expr: { $in: ["$_id", "$$userId"] } } },
            { $project: { password: 0, __v: 0 } },
          ],
          as: "userList",
        },
      },

      // Attach CASHOUT transactions
      {
        $lookup: {
          from: "transactions",
          let: { betIds: "$bets._id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ["$referenceId", "$$betIds"] },
                    {
                      $in: ["$transactionType", ["cashout", "partialCashout"]],
                    },
                  ],
                },
              },
            },
          ],
          as: "cashouts",
        },
      },
      // PROJECT — add missing fields here
      {
        $project: {
          _id: 1,
          gameType: 1,
          status: 1,
          totalSolCollected: 1,
          totalPlayers: 1,
          result: 1,
          totalBetAmount: 1,
          totalBetAmountUi: 1,
          startTime: 1,
          allowedBettingTill: 1,
          cashoutStartAt: 1,
          // cashoutValidTill: 1,
          endTime: 1,
          createdAt: 1,
          updatedAt: 1,
          gamedetails: 1,

          bets: {
            $map: {
              input: "$bets",
              as: "b",
              in: {
                $mergeObjects: [
                  "$$b",
                  {
                    userDetails: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$userList",
                            as: "u",
                            cond: { $eq: ["$$u._id", "$$b.userId"] },
                          },
                        },
                        0,
                      ],
                    },
                    remainingStake: {
                      $let: {
                        vars: {
                          cashList: {
                            $filter: {
                              input: "$cashouts",
                              as: "tx",
                              cond: { $eq: ["$$tx.referenceId", "$$b._id"] },
                            },
                          },
                        },
                        in: {
                          $subtract: [
                            "$$b.betamountUI",
                            {
                              $sum: {
                                $map: {
                                  input: "$$cashList",
                                  as: "c",
                                  in: {
                                    $divide: [
                                      "$$c.transactionAmount",
                                      { $toDouble: "$$c.result" },
                                    ],
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    },
                    cashOutDetails: {
                      $filter: {
                        input: "$cashouts",
                        as: "tx",
                        cond: {
                          $eq: ["$$tx.referenceId", "$$b._id"],
                        },
                      },
                    },
                    totalCashoutAmount: {
                      $sum: {
                        $map: {
                          input: {
                            $filter: {
                              input: "$cashouts",
                              as: "tx",
                              cond: {
                                $and: [
                                  { $eq: ["$$tx.referenceId", "$$b._id"] }, // only transactions for this bet
                                  {
                                    $in: [
                                      "$$tx.transactionType",
                                      ["cashout", "partialCashout"],
                                    ],
                                  }, // only cashouts
                                ],
                              },
                            },
                          },
                          as: "c",
                          in: "$$c.transactionAmount",
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ]);

    if (!crashLiveGameData) return undefined;

    // Clean seeds based on status
    if (crashLiveGameData.gamedetails) {
      switch (crashLiveGameData.status) {
        case "creating-onchain":
        case "accepting-Bets":
          crashLiveGameData.gamedetails.publicSeed = null;
          crashLiveGameData.gamedetails.serverSeed = null;
          crashLiveGameData.result = 0;
          break;
        case "accepting-Bets-Ended":
          crashLiveGameData.gamedetails.publicSeed = null;
          crashLiveGameData.gamedetails.serverSeed = null;
          break;
        case "in-progress":
          crashLiveGameData.gamedetails.serverSeed = null;
          break;
      }
    }

    return crashLiveGameData;
  } catch (err) {
    console.error("Error fetching/updating game data:", err.message);
    return undefined;
  }
}

export async function fetchOnLiveGameData() {
  try {
    let crashGames = await gameSession
      .find({ gameType: "crash" })
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

/** Create a new crash game */
// export const createNewCrashGame = async (type) => {
//   try {
//     let gameConfigData = await gameConfig.findOne({
//       gameType: "crash",
//     });
//     if (!gameConfigData) {
//       return { status: false, message: "Gno config data is found" };
//     } else if (!gameConfigData.isEnabled) {
//       return { status: false, message: "game has stoped for temporarly" };
//     }
//     const runningGame = await gameSession.findOne({
//       status: {
//         $in: [
//           "creating-onchain",
//           "in-progress",
//           "crashed",
//           "accepting-Bets",
//           "in-progress",
//           "accepting-Bets-Ended",
//         ],
//       },
//       gameType: "crash",
//     });

//     if (runningGame) {
//       console.warn("A crash game is already running:", runningGame._id);
//       if (
//         new Date() >= new Date(runningGame.endTime) &&
//         runningGame.status !== "finished"
//       ) {
//         await getOrUpdateLiveGameData(runningGame._id, "finished");
//       }

//       return { status: false, message: "Game already running" };
//     }

//     const roundId = await generateUniqueGameId();
//     const serverSeed = await serverSeedGeneration();
//     const publicSeed = await publicSeedGeneration();

//     const hashedServerSeed = crypto
//       .createHash("sha256")
//       .update(serverSeed)
//       .digest("hex");
//     const gameHash = await getGameHash(serverSeed, publicSeed);
//     const multiplier = await multiplierCalculator(gameHash);

//     const gamesession = await newGameSession(type, multiplier);

//     const newCrashGame = await NewGameModel.create({
//       gamesession: gamesession._id,
//       gameId: roundId,
//       serverSeed,
//       publicSeed,
//       startGameHash: "",
//       hashedServerSeed,
//     });

//     const [mergedGame] = await NewGameModel.aggregate([
//       { $match: { _id: newCrashGame._id } },
//       {
//         $lookup: {
//           from: "gamesessions",
//           localField: "gamesession",
//           foreignField: "_id",
//           as: "gamesession",
//         },
//       },
//       { $unwind: "$gamesession" },
//       {
//         $replaceRoot: {
//           newRoot: { $mergeObjects: ["$gamesession", "$$ROOT"] },
//         },
//       },
//       { $project: { __v: 0 } },
//     ]);

//     return { status: true, data: mergedGame };
//   } catch (err) {
//     console.error("Error creating new crash game:", err);
//     return { status: false, error: err.message };
//   }
// };

export const createNewCrashGame = async (type) => {
  try {
    let gameConfigData = await gameConfig.findOne({ gameType: "crash" });
    console.log("🚀 ~ createNewCrashGame ~ gameConfigData:", gameConfigData);

    if (!gameConfigData) {
      return { status: false, message: "No config data is found" };
    } else if (!gameConfigData.isEnabled) {
      return { status: false, message: "game has stopped temporarily" };
    }

    const runningGame = await gameSession.findOne({
      status: {
        $in: [
          "creating-onchain",
          "in-progress",
          "crashed",
          "accepting-Bets",
          "accepting-Bets-Ended",
        ],
      },
      gameType: "crash",
    });

    if (runningGame) {
      if (
        new Date() >= new Date(runningGame.endTime) &&
        runningGame.status !== "finished"
      ) {
        await getOrUpdateLiveGameData(runningGame._id, "finished");
      }
      return { status: false, message: "Game already running" };
    }

    const roundId = await generateUniqueGameId();

    // -------------------------
    // MULTIPLIER RETRY LOGIC
    // -------------------------
    let finalServerSeed,
      finalPublicSeed,
      finalHashedServerSeed,
      finalMultiplier,
      finalGameHash;

    finalServerSeed = await serverSeedGeneration();
    finalPublicSeed = await publicSeedGeneration();

    finalHashedServerSeed = crypto
      .createHash("sha256")
      .update(finalServerSeed)
      .digest("hex");

    finalGameHash = await getGameHash(finalServerSeed, finalPublicSeed);
    finalMultiplier = await multiplierCalculator(finalGameHash);

    // -------------------------
    // CREATE GAME SESSION
    // -------------------------
    const gamesession = await newGameSession(type, finalMultiplier);
    solanaManager.gameCreate({
      gameType: "crash",
      publicSeed: finalPublicSeed,
      hashedServerSeed: finalHashedServerSeed,
      roundId: gamesession._id,
    });
    const newCrashGame = await NewGameModel.create({
      gamesession: gamesession._id,
      gameId: roundId,
      serverSeed: finalServerSeed,
      publicSeed: finalPublicSeed,
      startGameHash: "",
      hashedServerSeed: finalHashedServerSeed,
    });

    const [mergedGame] = await NewGameModel.aggregate([
      { $match: { _id: newCrashGame._id } },
      {
        $lookup: {
          from: "gamesessions",
          localField: "gamesession",
          foreignField: "_id",
          as: "gamesession",
        },
      },
      { $unwind: "$gamesession" },
      {
        $replaceRoot: {
          newRoot: { $mergeObjects: ["$gamesession", "$$ROOT"] },
        },
      },
      { $project: { __v: 0 } },
    ]);

    return { status: true, data: mergedGame };
  } catch (err) {
    console.error("Error creating new crash game:", err);
    return { status: false, error: err.message };
  }
};

// export const createNewCrashGame = async (type) => {
//   try {
//     let gameConfigData = await gameConfig.findOne({ gameType: "crash" });

//     if (!gameConfigData) {
//       return { status: false, message: "No config data is found" };
//     } else if (!gameConfigData.isEnabled) {
//       return { status: false, message: "game has stopped temporarily" };
//     }

//     const runningGame = await gameSession.findOne({
//       status: {
//         $in: [
//           "creating-onchain",
//           "in-progress",
//           "crashed",
//           "accepting-Bets",
//           "accepting-Bets-Ended",
//         ],
//       },
//       gameType: "crash",
//     });

//     if (runningGame) {
//       if (
//         new Date() >= new Date(runningGame.endTime) &&
//         runningGame.status !== "finished"
//       ) {
//         await getOrUpdateLiveGameData(runningGame._id, "finished");
//       }
//       return { status: false, message: "Game already running" };
//     }

//     const roundId = await generateUniqueGameId();

//     // -------------------------
//     // MULTIPLIER RETRY LOGIC
//     // -------------------------
//     const MAX_RETRY = 10;
//     let attempts = [];

//     let finalServerSeed,
//       finalPublicSeed,
//       finalHashedServerSeed,
//       finalMultiplier,
//       finalGameHash;

//     // for (let i = 0; i < MAX_RETRY; i++) {
//       const serverSeed = await serverSeedGeneration();
//       const publicSeed = await publicSeedGeneration();

//       const hashedServerSeed = crypto
//         .createHash("sha256")
//         .update(serverSeed)
//         .digest("hex");

//       const gameHash = await getGameHash(serverSeed, publicSeed);
//       const multiplier = await multiplierCalculator(gameHash);

//       attempts.push({
//         serverSeed,
//         publicSeed,
//         hashedServerSeed,
//         gameHash,
//         multiplier,
//       });

//       // ✅ Accept immediately if < 400
//       // if (multiplier < 400) {
//         finalServerSeed = serverSeed;
//         finalPublicSeed = publicSeed;
//         finalHashedServerSeed = hashedServerSeed;
//         finalMultiplier = multiplier;
//         finalGameHash = gameHash;
//         // break;
//       // }
//     // }

//     // ❌ If all 10 are >= 400 → pick least multiplier
//     if (!finalMultiplier) {
//       const least = attempts.reduce((min, curr) =>
//         curr.multiplier < min.multiplier ? curr : min
//       );

//       finalServerSeed = least.serverSeed;
//       finalPublicSeed = least.publicSeed;
//       finalHashedServerSeed = least.hashedServerSeed;
//       finalMultiplier = least.multiplier;
//       finalGameHash = least.gameHash;

//       console.warn(
//         "All multipliers >= 400, using least:",
//         finalMultiplier
//       );
//     }
//     console.log("attempts",attempts)
//     // -------------------------
//     // CREATE GAME SESSION
//     // -------------------------
//     const gamesession = await newGameSession(type, finalMultiplier);
//     solanaManager.gameCreate({gameType : "crash",publicSeed : finalPublicSeed,hashedServerSeed : finalHashedServerSeed,roundId:gamesession._id});
//     const newCrashGame = await NewGameModel.create({
//       gamesession: gamesession._id,
//       gameId: roundId,
//       serverSeed: finalServerSeed,
//       publicSeed: finalPublicSeed,
//       startGameHash: "",
//       hashedServerSeed: finalHashedServerSeed,
//     });

//     const [mergedGame] = await NewGameModel.aggregate([
//       { $match: { _id: newCrashGame._id } },
//       {
//         $lookup: {
//           from: "gamesessions",
//           localField: "gamesession",
//           foreignField: "_id",
//           as: "gamesession",
//         },
//       },
//       { $unwind: "$gamesession" },
//       {
//         $replaceRoot: {
//           newRoot: { $mergeObjects: ["$gamesession", "$$ROOT"] },
//         },
//       },
//       { $project: { __v: 0 } },
//     ]);

//     return { status: true, data: mergedGame };
//   } catch (err) {
//     console.error("Error creating new crash game:", err);
//     return { status: false, error: err.message };
//   }
// };

async function generateUniqueGameId() {
  let id;
  let exists = true;

  while (exists) {
    id = uuidv4();
    exists = await NewGameModel.exists({ gameId: id });
  }

  return id;
}
