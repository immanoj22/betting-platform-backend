import mongoose from "mongoose";
import BetModel from "../../Commonmodel/BetSchema";
import RewardConfig from "../model/rewardConfig";
import rewardSession from "../model/rewardSession";
import TransactionModel from "../../Commonmodel/TransactionSChema"
import userRewardSchema from "../model/userReward";
import UserSchema from "../../User-service/model/UserSchema";
import isEmpty from "is-empty"

import seedrandom from "seedrandom";
import BigNumber from "bignumber.js";
import crypto from 'crypto'
import { UserServerSeeds } from "../../User-service/model/UserSeed";
import { createNewUserServerSeed } from "../../User-service/hooks/userHooks";
import { boxCasesRewards } from "../../levels/model/boxCasesRewards";
import dailycasebox from "../../levels/model/levelCasesBox";
import { redisPubliser } from "../../../service/redis/publisers/redisPublisers";
import { getVaultPda } from "../../../service/solanaTransactionService";
import liquiditySchema from "../../Dex/Models/liquidity.schema";



export const claimRewards = async (userDetails, type) => {
    try {
        // Fetch pending rewards grouped + list
        let reward = await userRewardSchema.aggregate([
            {
                $match: {
                    userId: userDetails._id,
                    assetType: type,
                    status: "pending"
                }
            },
            {
                $facet: {
                    totalAmount: [
                        {
                            $group: {
                                _id: null,
                                totalRewardAmount: { $sum: "$rewardAmount" }
                            }
                        }
                    ],
                    data: [
                        { $sort: { createdAt: -1 } }
                    ]
                }
            }
        ]);

        reward = reward[0];

        if (!reward) {
            return { status: false, message: "Reward not found" };
        }

        let rewardAmount = reward.totalAmount.length ? reward.totalAmount[0].totalRewardAmount : 0;

        if (rewardAmount <= 0) {
            return { status: false, message: "No reward amount to claim" };
        }

        const refererConfig = await RewardConfig.findOne({
            rewardFor: "referedBy",
            isEnabled: true
        });
        console.log("🚀 ~ claimRewards ~ refererConfig:", refererConfig,userDetails)

        const referDetails = userDetails.referredBy == "" ? null : await UserSchema.findOne({ _id: userDetails.referredBy });
        console.log("🚀 ~ claimRewards ~ referDetails:", referDetails)

        if (referDetails && refererConfig) {
            const referRewardAmount = (refererConfig.percentageOfWagerPool / 100) * rewardAmount;

            rewardAmount -= referRewardAmount;

            await userRewardSchema.create({
                rewardSessionId: refererConfig._id,
                userId: referDetails._id,
                rewardType: "refferedBy",
                assetType: type,
                rewardAmount: referRewardAmount,
                status: "pending"
            });
        }

        console.log('rewardAmount111-->',rewardAmount)
        let transactionHash =""
        if (type === "TOKEN" || type === "SOL") {
            // The on-chain payout path is not implemented here yet, so we do
            // not mark SOL/TOKEN rewards as claimed. Returning an explicit
            // response keeps the database honest until the transfer flow is
            // wired in.
            return {
                status: false,
                message: `${type} reward payout is not enabled yet`,
                data: 0
            };
        } else if (type === "XP") {
            const xpUpdate = await UserSchema.findOneAndUpdate(
                { _id: userDetails._id },
                { $inc: { xpMarker: rewardAmount } },
                { new: true }
            );

            if (!xpUpdate) {
                return { status: false, message: "Failed to apply XP reward" };
            }
        }

        const rewardIds = reward.data.map(r => r._id);
        const claimResult = await userRewardSchema.updateMany(
            { _id: { $in: rewardIds }, status: "pending" },
            { $set: { status: "claimed", claimedAt: new Date() } },
        );
        if (claimResult.modifiedCount !== rewardIds.length) {
            return { status: false, message: "Reward already claimed" };
        }

    const [airdropVault] =await getVaultPda("airdrop")

        await TransactionModel.create({
            userId: userDetails._id,
            fromAddress: airdropVault,
            toAddress: userDetails.walletAddress,
            transactionFrom: "system",
            transactionType:
                type === "SOL"
                    ? "rewards_claim_sol"
                    : type === "TOKEN"
                        ? "rewards_claim_token"
                        : "rewards_claim_xp",
            transactionAsset: type,
            transactionAmount: rewardAmount,
            transactionHash : "",
            status: "pending",
        });

        return {
            status: true,
            message:
                type === "XP"
                    ? "XP successfully claimed"
                    : "Reward successfully claimed",
            data: rewardAmount
        };

    } catch (err) {
        console.error("claimRewards error:", err);
        return { status: false, message: err.message };
    }
};


export const userWelcomeBonus = async () => {
    try {
        const config = await RewardConfig.findOne({ rewardFor: "welcomeBonus", isEnabled: true });

        if (!config) return console.log("No active welcomeBonus config found");

        const eligibleUsers = await UserSchema.aggregate([
            {
                $match: {
                    xpMarker: { $gte: config.minXp },
                    role: "user"  // user must meet XP requirement
                }
            },
            { $sort: { createdAt: -1 } },
        ]);

        if (!eligibleUsers.length) {
            return;
        }

        const usersToReward = [];

        for (const user of eligibleUsers) {
            const alreadyRewarded = await userRewardSchema.findOne({
                userId: user._id,
                rewardType: "welcomeBonus",  // any status counts as already received
            }).lean();

            if (!alreadyRewarded) {
                usersToReward.push(user);
            }
        }

        if (!usersToReward.length) {
            return {
                status: true,
                message: "No new eligible users to reward"
            };
        }

        const rewardsToInsert = usersToReward.map(u => ({
            rewardSessionId: config._id,
            userId: u._id,
            rewardType: "welcomeBonus",
            assetType: config.rewardAssetSymbol,
            rewardAmount: randomTip(config.minTip, config.maxTip),
            status: "pending"
        }));

        await userRewardSchema.insertMany(rewardsToInsert);

        return {
            status: true,
            message: "Welcome bonus distributed",
            rewardedCount: usersToReward.length,
            rewardedUsers: usersToReward.map(u => u._id)
        };

    } catch (err) {
        console.error("userWelcomeBonus error:", err.message);
        return { status: false, message: err.message };
    }
};

export function randomTip(min, max) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(3));
}

export const isUserElijibileForReward = async (userID) => {
    try {
        const user = await UserSchema.findOne({ _id: userID });
        if (!user) {
            return { status: false, message: "User not found" }
        }
        const dailycaseConfig = await RewardConfig.findOne({ rewardFor: "dailyCase", isEnabled: true });
        if (!dailycaseConfig) {
            return { status: false, message: "Daily case reward is not enabled currently" }
        }

        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const lastClaim = await userRewardSchema.findOne({
            userId: user._id,
            rewardType: "daily-case",
            status: { $in: ["claimed", "pending"] },
            createdAt: { $gte: twentyFourHoursAgo }
        });

        if (lastClaim) {
            const expiryTime = new Date(lastClaim.createdAt.getTime() + 24 * 60 * 60 * 1000);
            const remaining = expiryTime - now;

            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

            return {
                status: false,
                message: `Please try after ${hours}h ${minutes}m ${seconds}s`
            };
        }

        return { status: true, message: "User is eligible for daily case reward" }
    } catch (err) {
        console.error("isUserElijibileForReward error:", err.message);
        return { status: false, message: err.message };
    }
}

export const spinRewardWheel = async (userID) => {
    try {
        const user = await UserSchema.findById(userID);
        if (!user) return { status: false, message: "User not found" };

        let userActiveSeed = await UserServerSeeds.findOne({ userId: userID, isActive: true });
        if (!userActiveSeed) {
            const newSeed = await createNewUserServerSeed(user);
            if (!newSeed.status) return { status: false, message: newSeed.message };
            userActiveSeed = newSeed.data;
        }

        const eligibility = await isUserElijibileForReward(userID);
        if (!eligibility.status) return { status: false, message: eligibility.message };
        const dailycaseConfig = await RewardConfig.findOne({ rewardFor: "dailyCase", isEnabled: true });

        // RNG using provably fair seeds
        const saltedSeed = `${userActiveSeed.serverSeed}:${user.clientSeed}:${user.nounce}`;
        const rng = seedrandom(saltedSeed);
        const resultRaw = rng();
        const resultBps = new BigNumber(resultRaw).times(100_000_000).integerValue().toNumber();
        const resultPercentage = resultBps / 1e6; // numeric value like 36.2

        // find unlocked case by xp
        const userUnlockedCase = await dailycasebox.findOne({
            $and: [
                { minXp: { $lte: user.xpMarker } },
                { maxXp: { $gte: user.xpMarker } },]
        });
        if (!userUnlockedCase) return { status: false, message: "No unlocked case found" };

        if (user.totalWageredAmount < userUnlockedCase.minBetedAmount) {
            return { status: false, message: `User not eligible for daily case reward, minimum wagered amount required is ${dailycaseConfig.eligibleLevel}` }
        }
        // find reward based on probability range
        const reward = await boxCasesRewards.findOne({
            boxCaseId: userUnlockedCase._id,
            minProbalityPercentage: { $lte: resultPercentage },
            maxProbalityPercentage: { $gte: resultPercentage }
        });

        if (!reward) return { status: false, message: "No reward available for this spin result" };
        const userUpdated = await UserSchema.findOneAndUpdate(
            { _id: user._id },
            { $inc: { nounce: 1 } },
            { new: true }   // so we get updated value
        );

        await UserServerSeeds.findOneAndUpdate(
            { _id: userActiveSeed._id },
            {
                $inc: { numberOfTimeUsed: 1 },
                $set: { userNounce: userUpdated.nounce }
            }
        );
        // create reward claim history
        const lastClaim = await userRewardSchema.create({
            rewardSessionId: dailycaseConfig._id,
            userId: user._id,
            rewardType: "daily-case",
            assetType: reward.assetType.toUpperCase(),
            rewardAmount: reward.assetAmount,
            status: "pending"
        });




        return { status: true, message: "Spin successful", reward: { lastClaim, resultPercentage } };

    } catch (err) {
        console.error("spinRewardWheel error:", err);
        return { status: false, message: err.message };
    }
};
