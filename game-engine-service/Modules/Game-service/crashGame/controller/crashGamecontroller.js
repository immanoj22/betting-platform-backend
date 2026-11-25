import crypto from "crypto";
import isEmpty from "is-empty";
import { getGameHash, multiplierCalculator } from "../../../../library/multiplierlibrary";
import { paginationQuery } from "../../../../library/query";
import { sendResponse } from "../../../../service/response";
import GameSessionModel from "../../gamemodel/gameSession";
import NewGameModel from "../../gamemodel/gameModel";
import { getOrUpdateLiveGameData } from "../hooks/commonGamehook";
import gameConfig from "../../comonModel/gameConfig";

/**
 * Controller: getallCrashGame
 * Purpose:
 *   → Fetch all FINISHED Crash game sessions
 *   → Apply pagination (skip, limit)
 *   → Include related "newgames" details via $lookup
 *   → Return paginated list + total count in a single optimized query
 *
 * Query Params (req.query):
 *   - page  : Current page number (default handled in paginationQuery)
 *   - limit : Number of records per page
 *   - skip  : Auto-calculated: (page - 1) * limit
 *
 * Example request:
 *   GET /get_all_crashGame?page=1&limit=20
 */
export const getallCrashGame = async (req, res) => {
    try {
        // Extract pagination values from request query
        // paginationQuery returns { skip, limit, page }
        const { skip, limit, page } = paginationQuery(req.query);
        console.log("skip,limit,page",skip, limit, page)
        const result = await GameSessionModel.aggregate([
            {
                $match: {
                    gameType: "crash",
                    status: "finished"
                }
            },
            {
                $facet: {
                    data: [
                        { $sort: { createdAt: -1 } },

                        {
                            $lookup: {
                                from: "newgames",
                                localField: "_id",
                                foreignField: "gamesession",
                                as: "gameDetails"
                            }
                        },

                        { $skip: skip },
                        { $limit: limit }
                    ],

                    totalCount: [
                        { $count: "count" }
                    ]
                }
            }
        ]);

        const total = result[0]?.totalCount[0]?.count || 0;

        return sendResponse(res, {
            statusCode: 200,
            success: true,
            result: {
                data: result[0].data, page: page,
                limit: limit,
                total: total, totalPages: Math.ceil(total / limit),
            }
        });

    } catch (err) {
        console.log("__getallCrashGame err", err.message);

        return sendResponse(res, {
            statusCode: 500,
            success: false,
            message: err.message
        });
    }
};
export const crashGameVerify = async (req, res) => {
    try {
        const reqBody = req.body;
        const serverSeed = reqBody?.serverSeed;
        const publicSeed = reqBody?.publicSeed;
        if (isEmpty(publicSeed)) {
            return sendResponse(res, {
                statusCode: 400,
                success: false,
                message: "publicSeed is required"
            });
        }

        if (isEmpty(serverSeed)) {
            return sendResponse(res, {
                statusCode: 400,
                success: false,
                message: "serverSeed is required"
            });
        }

        // BS-GAME-006 fix: bind the reveal to its upfront commitment. Without
        // this, `verify` recomputed the multiplier but never checked that the
        // revealed serverSeed actually hashes to the published
        // hashedServerSeed, so the "proof" proved nothing.
        const gameRound = await NewGameModel.findOne({ publicSeed, serverSeed });
        if (isEmpty(gameRound) || isEmpty(gameRound.hashedServerSeed)) {
            return sendResponse(res, {
                statusCode: 400,
                success: false,
                message: "No matching game round found for the supplied seeds"
            });
        }

        const recomputedHash = crypto
            .createHash("sha256")
            .update(serverSeed)
            .digest("hex");

        if (recomputedHash !== gameRound.hashedServerSeed) {
            return sendResponse(res, {
                statusCode: 400,
                success: false,
                message: "Seed does not match the published commitment"
            });
        }

        const gameHashForSeed = await getGameHash(serverSeed, publicSeed);
        const multiplerResult = await multiplierCalculator(gameHashForSeed);
        return sendResponse(res, {
            statusCode: 200,
            success: true,
            result: { calculatedMultipler: multiplerResult }
        });
    } catch (err) {
        console.log("__crashGameVerify err", err.message);

        return sendResponse(res, {
            statusCode: 500,
            success: false,
            message: err.message
        });
    }
}

export const getCrashGamefullDetails=async(req,res)=>{
    try{
        console.log(req.query)
        const gameId=req.query?.gameId;
        if(isEmpty(gameId)){
            return sendResponse(res, {
                statusCode: 400,
                success: false,
                message: "gameId is required"
            });
        }
        const gameData=await getOrUpdateLiveGameData(gameId);
        return sendResponse(res, {
            statusCode: 200,
            success: true,
            result: { gameFullDetails: gameData }
        });
    }catch(err){
        console.log("__getCrashGamefullDetails err", err.message);

        return sendResponse(res, {
            statusCode: 500,
            success: false,
            message: err.message
        });
    }
}

export const crashGameConfigDetails = async (req, res) => {
    try {
        const data = await gameConfig.findOne({ gameType: "crash" });
        console.log("🚀 ~ crashGameConfigDetails ~ data:", data)

        if (!data) {
            return sendResponse(res, {
                statusCode: 404,
                success: false,
                message: "Crash game configuration not found"
            });
        }

        if (!data.isEnabled) {
            return sendResponse(res, {
                statusCode: 403,
                success: false,
                message: "Crash game is currently disabled"
            });
        }

        return sendResponse(res, {
            statusCode: 200,
            success: true,
            result: data,
            message: "Crash game configuration fetched successfully"
        });

    } catch (err) {
        console.log("__crashGameConfigDetails err:", err.message);

        return sendResponse(res, {
            statusCode: 500,
            success: false,
            message: "Internal server error"
        });
    }
};
