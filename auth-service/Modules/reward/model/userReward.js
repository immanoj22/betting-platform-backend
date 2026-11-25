import mongoose from "mongoose";


const rewardSchema = new mongoose.Schema(
  {
    rewardSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,                      // search optimization
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,                      // filter rewards per user
    },

    rewardType: {
      type: String,
      required: true,                   // "airdrop", "chat-reward", "daily-bonus"
      enum: ["airdrop", "chat-reward", "daily-bonus", "event", "level-up", "referral","welcomeBonus","refferedBy","daily-case","pool-reward"],
      index: true,
    },

    assetType: {
      type: String,
      required: true,                   // "SOL", "USD", "TOKEN"
      enum: ["SOL", "USD", "TOKEN", "XP"],
    },

    rewardAmount: {
      type: Number,
      default: 0,
    },

    claimedAt: {
      type: Date,
      default:null
    },

    status: {
      type: String,
      enum: ["pending", "claimed", "failed"],
      default: "pending",
      index: true,
    },

    // XP reward fields (optional for future use)
    // xpBefore: { type: Number, default: 0 },
    // xpGained: { type: Number, default: 0 },
    // xpAfter: { type: Number, default: 0 },

  },
  { timestamps: true }
);




const userRewardSchema=mongoose.model("userrewards",rewardSchema)
export default userRewardSchema
