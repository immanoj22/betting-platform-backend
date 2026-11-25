import jwt from "jsonwebtoken";
import UserSchema from "../../Modules/User-service/model/UserSchema.js";
import ChatSchema from "../../Modules/Chat-service/model/chatmodel.js";
import { redisPubliser } from "../../service/redis/publisers/redisPublisers.js";
import chatActivity from "../../Modules/Chat-service/model/chatActivity.js";
import rewardSession from "../../Modules/reward/model/rewardSession.js";
import { joinAirDropSession } from "../../Modules/airDrop/hooks/airDropHook.js";
import isEmpty from "is-empty";
import { claimRewards } from "../../Modules/reward/hooks/rewardHooks.js";
import gameConfig from "../../Modules/Commonmodel/gameConfig.js";

export default function initMainSocket(io) {
  io.on("connection", async (socket) => {
    const token =
      socket.handshake.auth?.token || socket.handshake.headers?.token;
    if (!token) {
      socket.isGuest = true;
      socket.user = null;
    } else {
      try {
        const decoded = jwt.verify(
          token.includes("Bearer") ? token.split(" ")[1] : token,
          process.env.JWT_SECRET || process.env.SECRET_KEY,
        );
        const user = await UserSchema.findOne({
          walletAddress: decoded.walletAddress,
        });

        if (user) {
          socket.user = user;
          socket.isGuest = false;
          socket.join(user._id.toString());
        } else {
          socket.isGuest = true;
        }
      } catch (err) {
        socket.isGuest = true;
      }
    }

    console.log("User Connected:", socket.id, "Guest:", socket.isGuest);

    socket.on("update_user", async () => {
      let user = await UserSchema.findOne({ _id: socket.user?._id });
      console.log("🚀 ~ initMainSocket ~ update_user:", user);
      socket.user = user;
    });

    socket.on("request_game_state", async () => {
      try {
        await redisPubliser("crash:game:recentState", "");
      } catch (err) {
        socket.emit("crash:error", { message: "Unable to fetch game state" });
      }
    });

    function requireAuth(socket, actionName) {
      console.log("socket.isGuest-->", socket.isGuest);
      if (socket.isGuest) {
        socket.emit("socket:error", {
          message: `Unauthorized: Login required for ${actionName}`,
        });
        return false;
      }
      return true;
    }

    // ----- CRASH: BET -----
    socket.on("crash:bet", async (payload) => {
      console.log("🚀 ~ initMainSocket ~ payload:", payload);
      if (!requireAuth(socket, "crash:bet")) return;
      if (typeof payload === "string") payload = JSON.parse(payload);
      const { amount, transactionHash, gameId } = payload;
      console.log("🚀 ~ initMainSocket ~ payload:", payload);
      payload.userDetails = socket.user;
      payload.currentBetTime = new Date();
      if (
        !amount ||
        (!payload.userDetails.instawalletEnable && !transactionHash) ||
        !gameId
      )
        return socket.emit("crash:error", { message: "Invalid bet payload" });

      console.log("🚀 ~ initMainSocket ~ payload:", payload);
      await redisPubliser("crash:place:bet", payload);
      return;
    });

    // ----- CRASH: CASHOUT -----
    socket.on("crash:cashout", async (payload) => {
      if (!requireAuth(socket, "crash:cashout")) return;

      if (typeof payload === "string") payload = JSON.parse(payload);
      const { gameId, progressCashOutPercentage } = payload;
      console.log(
        "!gameId || !progressCashOutPercentage-->",
        !gameId || !progressCashOutPercentage,
      );
      if (!gameId || !progressCashOutPercentage)
        return socket.emit("crash:error", {
          message: "Invalid cashout payload",
        });

      payload.userDetails = socket.user;
      payload.currentBetTime = new Date();

      await redisPubliser("crash:place:cashout", payload);
    });

    // ----- COINFLIP: NEW GAME -----
    socket.on("coinFlip:new", async (payload) => {
      console.log("🚀 ~ initMainSocket ~ payload:", payload);
      if (!requireAuth(socket, "coinFlip:new")) return;

      if (typeof payload === "string") payload = JSON.parse(payload);
      payload.userDetails = socket.user;
      payload.currentBetTime = new Date();
      console.log("🚀 ~ initMainSocket ~ payload:", payload);
      const { gameId, transactionHash, side, amount } = payload;
      if (
        !gameId ||
        !side ||
        !amount ||
        (!payload.userDetails.instawalletEnable && !transactionHash)
      )
        return socket.emit("coinFlip:error", {
          message: "Invalid coinFlip payload",
        });
      await redisPubliser("game:coin:newFlip", payload);
    });

    // ----- COINFLIP: BET AGAINST -----
    socket.on("coinFlip:betAgainstNew", async (payload) => {
      if (!requireAuth(socket, "coinFlip:betAgainstNew")) return;

      if (typeof payload === "string") payload = JSON.parse(payload);
      payload.userDetails = socket.user;

      await redisPubliser("game:coin:oppositeFlip", payload);
    });

    // ----- COINFLIP: CALL BOT -----
    socket.on("coinFlip:CallingBot", async (payload) => {
      if (!requireAuth(socket, "coinFlip:CallingBot")) return;

      if (typeof payload === "string") payload = JSON.parse(payload);
      let bots = await UserSchema.find({ role: "bot" });
      console.log("🚀 ~ initMainSocket ~ bots:", bots);

      if (!bots.length) return;

      const bot = bots[0]; //Math.floor(Math.random() * bots.length)];
      payload.userDetails = bot;

      await redisPubliser("game:coin:oppositeFlipBot", payload);
    });

    //chat
    socket.on("chat:send", async (payload) => {
      if (!requireAuth(socket, "chat:send")) return;

      console.log("payload-->", payload);
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch (e) {
          console.log("Invalid JSON payload");
          return;
        }
      }

      if (!payload.message?.trim()) return;
      const session = await rewardSession.findOne({
        gameType: "airDrop",
        endTime: { $gte: new Date() },
        status: { $ne: "finished" },
      });
      console.log("🚀 ~ initMainSocket ~ session:", session);

      const sessionId = session ? session._id : null;
      console.log("🚀 ~ initMainSocket ~ sessionId:", sessionId);

      const chatConfig = await gameConfig.findOne({
        gameType: "chat",
        isEnabled: true,
      });
      console.log("🚀 ~ initMainSocket ~ chatConfig:", chatConfig);

      if (!chatConfig) {
        return socket.emit("chat:error", {
          message: "Chat is currently disabled",
        });
      }

      console.log(
        "🚀 ~ initMainSocket ~ socket.user.totalWageredAmount:",
        socket.user.totalWageredAmount,
      );
      if ((socket.user.totalWageredAmount || 0) < chatConfig.minBetAmount) {
        return socket.emit("chat:error", {
          message: `You must wager at least ${chatConfig.minBetAmount} amount to chat`,
        });
      }

      const msg = await ChatSchema.create({
        userId: socket.user._id,
        message: payload.message,
        region: payload.region || "",
        language: payload.language || "",
      });
      console.log("🚀 ~ initMainSocket ~ msg:", msg);

      io.emit("chat:broadcast", {
        _id: msg._id,
        message: msg.message,
        createdAt: msg.createdAt,
        user: {
          _id: socket.user._id,
          username: socket.user.nickName,
          walletAddress: socket.user.walletAddress,
          profileImage: socket.user.profileImage,
        },
      });

      // -------------------------------
      // 3️⃣ Update participation only if airdrop session active
      // -------------------------------
      if (!sessionId) return;

      const existing = await chatActivity.findOne({
        userId: socket.user._id,
        sessionId,
      });

      const now = new Date();

      // Anti-spam: 10 second gap required
      if (existing && now - existing.lastMessageAt < 2 * 1000) {
        return; // ignore spam
      }

      // Update chat activity
      await chatActivity.findOneAndUpdate(
        { userId: socket.user._id, sessionId },
        {
          $inc: { messageCount: 1 },
          $set: { lastMessageAt: now },
        },
        { upsert: true },
      );
    });

    socket.on("chat:getLatest", async () => {
      const messages = await ChatSchema.aggregate([
        { $sort: { createdAt: -1 } },
        { $limit: 30 },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            _id: 1,
            message: 1,
            createdAt: 1,
            user: {
              _id: "$user._id",
              username: "$user.nickName",
              walletAddress: "$user.walletAddress",
              profileImage: "$user.profileImage",
            },
          },
        },
        { $sort: { createdAt: 1 } },
      ]);

      socket.emit("chat:latest", messages);
    });

    //airDrop
    socket.on("get:airDrop", async () => {
      const airDropsession = await rewardSession.findOne({
        gameType: "airDrop",
        endTime: { $gte: new Date() },
        status: { $ne: "finished" },
      });
      socket.emit("airDrop:status", { data: airDropsession });
    });

    socket.on("airDrop:Join", async (payload) => {
      if (!requireAuth(socket, "airDrop:Join")) return;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch (e) {
          console.log("Invalid JSON payload", e.message);
          return;
        }
      }
      if (
        isEmpty(payload.transactionHash) ||
        isEmpty(payload.amount) ||
        isEmpty(payload.gameId)
      ) {
        socket.emit("airDrop:error", {
          message: "required parameters are missing",
        });
        return;
      }
      payload.userDetails = socket.user;
      console.log(
        "🚀 ~ initMainSocket ~ payload.userDetails:",
        payload.userDetails,
      );
      await joinAirDropSession(payload, io, socket);
    });

    socket.on("claim:reward", async (payload) => {
      try {
        if (!requireAuth(socket, "claim:reward")) return;
        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch (e) {
            console.log("Invalid JSON payload");
            return;
          }
        }
        // payload.userDetails = socket.user;
        const { rewardId } = payload;
        const userDetails = socket.user; // your auth middleware should set this
        if (!rewardId) {
          return socket.emit("reward:claim:response", {
            status: false,
            message: "Reward ID required",
          });
        }

        if (!userDetails || !userDetails._id) {
          return socket.emit("reward:claim:response", {
            status: false,
            message: "User authentication failed",
          });
        }

        const result = await claimRewards(rewardId, userDetails);

        return socket.emit("reward:claim:response", result);
      } catch (err) {
        console.error("Socket claim reward error:", err);
        return socket.emit("reward:claim:response", {
          status: false,
          message: "Something went wrong during reward claim",
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
}
