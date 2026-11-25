import isEmpty from "is-empty"
import { sendResponse } from "../../../service/response"
import rewardSession from "../model/rewardSession"
import userRewardSchema from "../model/userReward"
import UserSchema from "../../User-service/model/UserSchema"
import { claimRewards, randomTip, spinRewardWheel } from "../hooks/rewardHooks"
import RewardConfig from "../model/rewardConfig"
import { deactivateUserSeed } from "../../User-service/hooks/userHooks"
import { UserServerSeeds } from "../../User-service/model/UserSeed"
import dailycasebox from "../../levels/model/levelCasesBox"

export const getUserRewardDetails = async (req, res) => {
    try {
        const user = req.user
        const RemainRewards = await userRewardSchema.aggregate([
            { $match: { userId: user._id, status: "pending" } },
            {
                $group: {
                    _id: "$assetType",
                    totalAmount: { $sum: "$rewardAmount" }
                }
            }
        ])
        const totalClaimedAmount = await userRewardSchema.aggregate([
            { $match: { userId: user._id } },
            {
                $group: {
                    _id: { status: "$status", assetType: "$assetType" },
                    totalAmount: { $sum: "$rewardAmount" }
                }
            }
        ]);

        return sendResponse(res, {
            status: true,
            statusCode: 200,
            message: "reward details fetched successfully",
            result: {
                data: totalClaimedAmount,
                allRemaingRewards: RemainRewards,
            },
        });
    } catch (err) {
        console.log("__fetch reward err", err.message)
        return sendResponse(res, {
            status: false,
            statusCode: 500,
            message: "Wallet settings updated successfully",
            errors: err.message
        });
    }
}

export const redeemRefrealBonus = async (req, res) => {
    try {
        const user = req?.user;
        const referralCode = req.body?.referralCode
        if (!user || !referralCode) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: "invalid payload",
            });
        }
        const userDetails = await UserSchema.findOne({ _id: user._id });
        if (!userDetails) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: "invalid user",
            });
        }
        if (!isEmpty(userDetails.referredBy)) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: "already you have redemed refral code",
            });
        }
        if (userDetails.referralCode == referralCode) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: "you can't redem own code",
            });
        }
        const refererDetails = await UserSchema.findOne({ referralCode: referralCode })
        if (!refererDetails) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: "invalid refral code",
            });
        }

        userDetails.referredBy = refererDetails._id;
        userDetails.save();

        const refererConfigDetails = await RewardConfig.findOne({ rewardFor: "referral", isEnabled: true });

        //user that is redemed gets rewards
        if (!isEmpty(refererConfigDetails)) {
            await userRewardSchema.create({
                rewardSessionId: refererConfigDetails._id,
                userId: userDetails._id,
                rewardType: "referral",
                assetType: refererConfigDetails.rewardAssetSymbol,
                rewardAmount: randomTip(refererConfigDetails.minTip, refererConfigDetails.maxTip),
                status: "pending"
            });
        }

        const refereredByConfigDetails = await RewardConfig.findOne({ rewardFor: "referedBy", isEnabled: true });

        //referer gets reward
        if (!isEmpty(refereredByConfigDetails)) {
            await userRewardSchema.create({
                rewardSessionId: refereredByConfigDetails._id,
                userId: refererDetails._id,
                rewardType: "refferedBy",
                assetType: refereredByConfigDetails.rewardAssetSymbol,
                rewardAmount: randomTip(refereredByConfigDetails.minTip, refereredByConfigDetails.maxTip),
                status: "pending"
            });
        }

        return sendResponse(res, {
            status: true,
            statusCode: 201,
            message: "reffred successfully",
        }); 

    } catch (err) {
        console.log("__redeemRefrealBonus err", err.message)
        return sendResponse(res, {
            status: false,
            statusCode: 500,
            message: err.message,
            errors: err.message
        });
    }
}

export const getReffralDetails = async (req, res) => {
    try {
        const user = req.user
        const totalRefredUser = await UserSchema.find({ referredBy: user._id, }).countDocuments()
        const totalEarnings = await userRewardSchema.aggregate([
            {
                $match: {
                    userId: user._id,
                    rewardType: "refferedBy",
                    status: "claimed"
                }
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$rewardAmount" }
                }
            }
        ]);

        const total = totalEarnings[0]?.totalAmount || 0;
        const data = {
            totalReferedPlayer: totalRefredUser,
            totalReferedEarning: total
        }
        return sendResponse(res, {
            status: true,
            statusCode: 200,
            message: "reward details fetched successfully",
            result: {
                data: data
            },
        });
    } catch (err) {
        console.log("__getReffralDetails err", err.message)
        return sendResponse(res, {
            status: false,
            statusCode: 500,
            message: "err happened",
            errors: err.message
        });
    }
}

export const getRewardConfig = async (req, res) => {
    try {
        const type = req.query?.type
        if (!type) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: "type is requried",
            });
        }
        const data = await RewardConfig.findOne({ rewardFor: type });
        if (!data) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: "no data is found",
            });
        }
        return sendResponse(res, {
            status: true,
            statusCode: 200,
            message: "reward config fetched successfully",
            result: {
                data: data
            },
        });
    } catch (err) {
        console.log("__getRewardConfig err", err.message)
        return sendResponse(res, {
            status: false,
            statusCode: 500,
            message: "err happened",
            errors: err.message
        });
    }
}

export const spinDailyCase = async (req, res) => {
    try {
        const user = req.user;
        const isUserExist = await UserSchema.findOne({ _id: user._id });
        if (!isUserExist) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: "User not found"
            });
        }
        const spinResult = await spinRewardWheel(user._id);
        if (!spinResult.status) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: spinResult.message
            });
        }
        return sendResponse(res, {
            status: true,
            statusCode: 200,
            message: spinResult.message,
            result: {
                data: spinResult.reward
            }
        });
    } catch (err) {
        console.log("__spinDailyCase err", err.message);
        return sendResponse(res, {
            status: false,
            statusCode: 500,
            message: "Error occurred while claiming daily case reward",
            errors: err.message
        });
    }
}

export const retireServerSeed = async (req, res) => {
    try {
        const user = req.user;
        const seedID = req.query?.seedID;
        if (!seedID) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: "seedID is required"
            });
        }
        const isUserExist = await UserSchema.findOne({ _id: user._id });
        if (!isUserExist) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: "User not found"
            });
        }
        const { status, message } = await deactivateUserSeed(user._id, seedID);
        if (!status) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: message
            });
        }
        return sendResponse(res, {
            status: true,
            statusCode: 200,
            message: message
        });
    } catch (err) {
        console.log("__retireServerSeed err", err.message);
        return sendResponse(res, {
            status: false,
            statusCode: 500,
            message: "Error occurred while retiring server seed",
            errors: err.message
        });
    }
}

export const getUserServerSeed = async (req, res) => {
    try {
        const user = req.user;
        const isUserExist = await UserSchema.findOne({ _id: user._id });
        if (!isUserExist) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: "User not found"
            });
        }
        const userSeeds = await UserServerSeeds.aggregate([
            { $match: { userId: user._id } },
            {
                $project: {
                    userId: 1,
                    isActive: 1,
                    numberOfTimeUsed: 1,
                    userNounce: 1,
                    hashedServerSeed: 1,   // always include
                    serverSeed: {
                        $cond: {
                            if: { $eq: ["$isActive", true] },   // if active
                            then: null,                         // hide serverSeed
                            else: "$serverSeed"                // show only if inactive
                        }
                    }
                }
            }
        ]);

        return sendResponse(res, {
            status: true,
            statusCode: 200,
            message: "User server seeds fetched successfully",
            result: {
                data: userSeeds
            }
        });
    } catch (err) {
        console.log("__getUserServerSeed err", err.message);
        return sendResponse(res, {
            status: false,
            statusCode: 500,
            message: "Error occurred while fetching user server seeds",
            errors: err.message
        });
    }
}

export const claimUserReward = async (req, res) => {
    try {
        const assetType = req.query?.assetType;
        console.log("🚀 ~ claimUserReward ~ assetType:", assetType)
        if (!assetType) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,    
                message: "assetType is required",
            });
        }
        const user = req.user;
        const userDetails = await UserSchema.findOne({ _id: user._id });
        if (!userDetails) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: "invalid user",
            });
        }
        
        const claimResult = await claimRewards(userDetails, assetType);
        if (!claimResult.status) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: claimResult.message,
                result: claimResult.data
            });
        }
        return sendResponse(res, {
            status: true,
            statusCode: 200,
            message: claimResult.message,
            result: claimResult.data
        });
    } catch (err) {
        console.log("__claimUserReward err", err.message);
        return sendResponse(res, {
            status: false,
            statusCode: 500,
            message: "Error occurred while claiming user reward",
            errors: err.message
        });
    }
}

export const userDailycaseBoxDetails = async (req, res) => {
    try {
        const user = req.user;
        const userDetails = await UserSchema.findOne({ _id: user._id });
        if (!userDetails) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: "User not found"
            });
        }
        const rewardBoxDetails = await dailycasebox.aggregate([
            {
                $match: {
                    minXp: { $lte: userDetails.xpMarker },
                    maxXp: { $gte: userDetails.xpMarker }
                }
            },
            {
                $lookup: {
                    from: "boxrewards",
                    localField: "_id",
                    foreignField: "boxCaseId",
                    as: "rewardsPercentages"
                }
            }
        ]);

        return sendResponse(res, {
            status: true,
            statusCode: 200,
            message: "Daily case box details fetched successfully",
            result: {
                data: rewardBoxDetails[0]
            }
        });
    } catch (err) {
        console.log("__userDailycaseBoxDetails err", err.message);
        return sendResponse(res, {
            status: false,
            statusCode: 500,
            message: "Error occurred while fetching daily case box details",
            errors: err.message
        });
    }
}
export const getAllDailyCaseBox = async (req, res) => {
    try {
        const user = req.user;
        const userDetails = await UserSchema.findOne({ _id: user._id });

        if (!userDetails) {
            return sendResponse(res, {
                status: false,
                statusCode: 400,
                message: "User not found"
            });
        }

        const boxes = await dailycasebox.aggregate([
            {
                $lookup: {
                    from: "boxrewards",
                    localField: "_id",
                    foreignField: "boxCaseId",
                    as: "rewardsPercentages"
                }
            },
            {
                $sort: { minXp: 1 }   // sort ascending by minXp
            },
            {
                $addFields: {
                    rewardPlanAvailable: {
                        $switch: {
                            branches: [
                                {
                                    case: { $gt: [userDetails.xpMarker, "$maxXp"] },
                                    then: "completed"
                                },
                                {
                                    case: {
                                        $and: [
                                            { $lte: ["$minXp", userDetails.xpMarker] },
                                            { $gte: ["$maxXp", userDetails.xpMarker] }
                                        ]
                                    },
                                    then: "active"
                                }
                            ],
                            default: "locked"
                        }
                    }
                }
            }
        ]);


        return sendResponse(res, {
            status: true,
            statusCode: 200,
            message: "All daily case boxes fetched successfully",
            result: {
                userXp: userDetails.xpMarker,  // 👈 Added here
                data: boxes
            }
        });

    } catch (err) {
        console.log("__getAllDailyCaseBox err", err.message);
        return sendResponse(res, {
            status: false,
            statusCode: 500,
            message: "Error occurred while fetching all daily case boxes",
            errors: err.message
        });
    }
};

