import isEmpty from "is-empty";
import { getGameHash } from "../../../../library/multiplierlibrary";
import { sendResponse } from "../../../../service/response";
import GameSessionModel from "../../gamemodel/gameSession";
import gameConfig from "../../comonModel/gameConfig";
import { createNewCoinFlipGame } from "../hooks/commonGamehook";

export const getallcoinFlipGame = async (req, res) => {
  try {
    const { limit, page } = req.query;
    console.log("-->");
    const result = await GameSessionModel.aggregate([
      {
        $match: {
          gameType: "coinFlip",
          status: { $ne: "initiate" },
          ...(limit || page ? { totalPlayers: { $eq: 2 } } : {}),
          // totalPlayers: { $eq: 2 },
          //   status: "finished",
        },
      },
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },

            // 1) Lookup game details
            {
              $lookup: {
                from: "newgames",
                localField: "_id",
                foreignField: "gamesession",
                as: "gameDetails",
              },
            },

            // 2) Lookup bets
            {
              $lookup: {
                from: "bets",
                localField: "_id",
                foreignField: "gameId",
                as: "bettingDetails",
              },
            },

            // 3) Lookup users for each bet
            {
              $lookup: {
                from: "users",
                localField: "bettingDetails.userId",
                foreignField: "_id",
                as: "betterDetails",
              },
            },

            // 4) Merge user inside each bet
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
                                  input: "$betterDetails",
                                  as: "u",
                                  cond: { $eq: ["$$u._id", "$$bet.userId"] },
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

            // 5) Remove temp lookup + hide sensitive fields
            {
              $project: {
                betterDetails: 0, // remove temp array
                "bettingDetails.betterDetails.password": 0,
                "bettingDetails.betterDetails.email": 0,
                "bettingDetails.betterDetails.__v": 0,
              },
            },
          ],

          totalCount: [{ $count: "count" }],
        },
      },
    ]);

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      result: {
        data: result[0]?.data || [],
        total: result[0]?.totalCount[0]?.count || 0,
      },
    });
  } catch (err) {
    console.log("__getallCoinFlipGame err", err.message);

    return sendResponse(res, {
      statusCode: 500,
      success: false,
      message: err.message,
    });
  }
};

export const verifyCoinFlipGame = async (req, res) => {
  try {
    const reqBody = req.body;
    const serverSeed = reqBody?.serverSeed;
    const publicSeed = reqBody?.publicSeed;
    if (isEmpty(publicSeed)) {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        message: "publicSeed is required",
      });
    }

    if (isEmpty(serverSeed)) {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        message: "serverSeed is required",
      });
    }
    const gameHash = await getGameHash(serverSeed, publicSeed);
    const parsedNumber = parseInt(gameHash.slice(0, 16), 16);
    const coinflipResult = parsedNumber % 1_000_000;
    return sendResponse(res, {
      statusCode: 200,
      success: true,
      result: {
        data: { result: coinflipResult },
      },
    });
  } catch (err) {
    console.log("__getallCoinFlipGame err", err.message);

    return sendResponse(res, {
      statusCode: 500,
      success: false,
      message: err.message,
    });
  }
};

export const getallcoinFlipGameConfig = async (req, res) => {
  try {
    const data = await gameConfig.findOne({ gameType: "coinflip" });
    if (!data) {
      return sendResponse(res, {
        statusCode: 404,
        success: false,
        message: "coinflip game configuration not found",
      });
    }

    if (!data.isEnabled) {
      return sendResponse(res, {
        statusCode: 403,
        success: false,
        message: "coinflip game is currently disabled",
      });
    }

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      result: data,
      message: "coinflip game configuration fetched successfully",
    });
  } catch (err) {
    console.log("__coinflipGameConfigDetails err:", err.message);

    return sendResponse(res, {
      statusCode: 500,
      success: false,
      message: "Internal server error",
    });
  }
};

export const getnewCoinFlipGame = async (req, res) => {
  try {
    const createdGame = await createNewCoinFlipGame("coinFlip");
    if (!createdGame.status) {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        message: "error happened while creating",
      });
    }
    return sendResponse(res, {
      statusCode: 200,
      success: true,
      result: { data: createdGame },
      message: "coinflip game has created",
    });
  } catch (err) {
    return sendResponse(res, {
      statusCode: 500,
      success: false,
      message: "Internal server error",
    });
  }
};
