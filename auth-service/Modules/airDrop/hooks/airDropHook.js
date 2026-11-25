import BetModel from "../../Commonmodel/BetSchema";
import RewardConfig from "../../reward/model/rewardConfig";
import rewardSession from "../../reward/model/rewardSession";
import TransactionModel from "../../Commonmodel/TransactionSChema";
import userRewardSchema from "../../reward/model/userReward";
import {
  sendSol,
  verifyTransaction,
} from "../../../service/solanaTransactionService";
import UserSchema from "../../User-service/model/UserSchema";

const toLamports = (sol) => (isNaN(sol) ? 0 : Math.floor(sol * 1e9));

export const joinAirDropSession = async (payload, io, socket) => {
  try {
    console.log("🚀 ~ joinAirDropSession ~ payload:", payload);
    let { userDetails, amount, transactionHash, gameId, instawalletEnable } =
      payload;

    if (!gameId) {
      return socket.emit("user:airdrop:error", {
        status: false,
        message: "Airdrop ID required",
      });
    }

    if (!userDetails || !userDetails._id) {
      return socket.emit("user:airdrop:error", {
        status: false,
        message: "Invalid user",
      });
    }

    if (!amount || amount <= 0) {
      return socket.emit("user:airdrop:error", {
        status: false,
        message: "Invalid airdrop participation amount",
      });
    }

    if (!transactionHash) {
      return socket.emit("user:airdrop:error", {
        status: false,
        message: "Transaction hash required",
      });
    }

    const activeAirdropConfig = await RewardConfig.findOne({
      rewardFor: "airDrop",
      isEnabled: true,
    });

    if (!activeAirdropConfig) {
      return socket.emit("user:airdrop:error", {
        status: false,
        message: "Airdrop is currently disabled",
      });
    }

    const session = await rewardSession.findOne({
      _id: gameId,
      gameType: "airDrop",
      status: "accepting-Tip",
      startTime: { $lte: new Date() },
      allowedBettingTill: { $gte: new Date() },
    });

    if (!session) {
      return socket.emit("user:airdrop:error", {
        status: false,
        message: "No active airdrop session right now",
      });
    }

    const existingTx = await TransactionModel.findOne({ transactionHash });
    if (existingTx) {
      return socket.emit("user:airdrop:error", {
        status: false,
        message: "This transaction already processed",
      });
    }

    const isexistingAirdropJoinee = await BetModel.findOne({
      userId: userDetails._id,
      gameId: session._id,
      gameStatus: "in-play",
    });

    if (isexistingAirdropJoinee) {
      return socket.emit("user:airdrop:error", {
        status: false,
        message: "You already joined",
      });
    }

    // if (instawalletEnable) {
    //   transactionHash = sendSol(userDetails.walletAddress, amount, "airdrop");
    //   if (transactionHash?.status) {
    //     transactionHash = transactionHash.tx;
    //   }
    // }

    let txData = await verifyTransaction(transactionHash);

    if (!txData.status || txData.amount != parseFloat(amount)) {
      return socket.emit("user:airdrop:error", {
        status: false,
        message: "Invalid Transaction Hash",
      });
    }

    // if (instawalletEnable) {
    //   await UserSchema.findByIdAndUpdate(
    //     {
    //       _id: userDetails._id,
    //       instawalletbalance: { $gte: amount },
    //     },
    //     {
    //       $inc: {
    //         instawalletbalance: -amount,
    //       },
    //     },
    //   );
    // }

    const tx = await TransactionModel.create({
      userId: userDetails._id,
      fromAddress: userDetails.walletAddress,
      toAddress: process.env.PROGRAM_ID,
      transactionFrom: "wallet",
      transactionType: "airdrop-join",
      transactionAsset: "SOL",
      transactionAmount: amount,
      transactionHash,
      gameId: session._id,
      referenceId: session._id,
      isFromInstaWallet: instawalletEnable,
      status: "completed",
    });

    const bet = await BetModel.create({
      userId: userDetails._id,
      gameId: session._id,
      betamount: toLamports(amount),
      betamountUI: amount,
      inPlayamount: toLamports(amount),
      inPlayamountUI: amount,
      profitamount: 0,
      profitamountUI: 0,
      profitLossAmount: 0,
      transactionHash,
      isFromInstaWallet: instawalletEnable,
      gameStatus: "in-play",
    });

    await rewardSession.findByIdAndUpdate(session._id, {
      $inc: {
        totalSolCollected: amount,
        totalPlayers: 1,
      },
    });

    socket.emit("user:airdrop:success", {
      status: true,
      message: "Joined airdrop successfully",
      sessionId: session._id,
      txId: tx._id,
      betId: bet._id,
      userDetail: userDetails,
      createdAt: tx.createdAt,
    });

    // io.emit("airdrop:player:joined", {
    //     userId: userDetails._id,
    //     amount,
    //     sessionId: session._id,
    //     status: true,
    //     message: "Joined airdrop successfully",
    //     sessionId: session._id,
    //     txId: tx._id,
    //     betId: bet._id,
    //     userDetail : userDetails,
    //     createdAt: tx.createdAt
    // });
  } catch (err) {
    console.log("__joinAirDropSession error:", err.message);
    socket.emit("user:airdrop:error", {
      status: false,
      message: err.message,
    });
  }
};

let rewardpool = 200;

export const payAirdropWinners = async (sessionId, io) => {
  try {
    const rewardConfig = await RewardConfig.findOne({
      rewardFor: "airDrop",
      isEnabled: true,
    });
    const session = await rewardSession.findById(sessionId);
    if (!session) {
      console.log("Session not found");
      return;
    }

    // Ensure session is finished
    if (new Date() < new Date(session.allowedBettingTill)) {
      console.log("Session still active");
      return;
    }

    // Fetch all participants
    const participants = await BetModel.aggregate([
      {
        $match: {
          gameId: sessionId,
          gameStatus: "in-play",
        },
      },
      {
        $lookup: {
          from: "chatactivities",
          let: { uid: "$userId", sid: "$gameId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$userId", "$$uid"] },
                    { $eq: ["$sessionId", "$$sid"] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                lastMessageAt: 1,
                messageCount: 1,
              },
            },
          ],
          as: "chatDetails",
        },
      },
      {
        $unwind: {
          path: "$chatDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
    ]);

    if (participants.length === 0) {
      console.log("No participants in this airdrop");
      return;
    }

    const totalRewards =
      session.totalSolCollected +
      (rewardpool * rewardConfig.percentageOfWagerPool) / 100;

    // Bug fix (BS-GAME-013, part 2): the pot was divided across every
    // participant, but only eligible ones ever got a reward record —
    // the ineligible share was silently retained/lost every round instead
    // of being distributed. Divide only across those who actually qualify.
    const eligibleParticipants = participants.filter(
      (p) => p.userId && (p.chatDetails?.messageCount || 0) >= rewardConfig.eligibleLevel,
    );
    const rewardPerUser =
      eligibleParticipants.length > 0
        ? totalRewards / eligibleParticipants.length
        : 0;
    console.log(rewardConfig, "rewardType");
    for (const p of participants) {
      if (!p.userId) continue;

      const isEligible =
        (p.chatDetails?.messageCount || 0) >= rewardConfig.eligibleLevel;

      if (isEligible) {
        await userRewardSchema.create({
          rewardSessionId: sessionId,
          userId: p.userId,
          rewardType: "airdrop",
          assetType: rewardConfig.rewardType.toUpperCase(),
          rewardAmount: rewardPerUser,
          status: "pending",
        });

        await BetModel.updateOne(
          { userId: p.userId, gameId: sessionId },
          {
            $set: {
              gameStatus: "completed",
              profitamount: toLamports(rewardPerUser),
              profitamountUI: rewardPerUser,
            },
          },
        );

        io.to(p.userId.toString()).emit("airDrop:reward", {
          status: true,
          reward: rewardPerUser,
          message: "Congratulations! You are eligible for rewards",
        });
      } else {
        await BetModel.updateOne(
          { userId: p.userId, gameId: sessionId },
          {
            $set: {
              gameStatus: "busted",
              profitLossAmount: session.totalSolCollected / participants.length,
            },
          },
        );

        io.to(p.userId.toString()).emit("airDrop:reward", {
          status: false,
          reward: 0,
          message: "Not eligible for reward. Chat more next time!",
        });
      }
    }

    session.status = "finished";
    session.endTime = new Date();
    await session.save();

    return {
      status: true,
      message: "Airdrop rewards distributed successfully",
      totalWinners: participants.length,
      rewardPerUser,
    };
  } catch (err) {
    console.log("__payAirdropWinners error:", err.message);
    return {
      status: false,
      message: err.message,
    };
  }
};
