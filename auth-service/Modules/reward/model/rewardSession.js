import mongoose from "mongoose";

const rewardSessionSchema = new mongoose.Schema(
  {
    gameType: {
      type: String, // crash, coinflip, airdrop, reward
      required: true,
    },
    status: {
      type: String,
      enum: ["creating-onchain", "finished", "distributing-rewards", "accepting-Tip","accepting-Tip-Ended"],
      default: "creating-onchain",
    },
    totalSolCollected: {
      type: Number,
      default: 0,
    },
    totalPlayers: {
      type: Number,
      default: 0,
    },

    startTime: {
      type: Date,
      default: () => new Date(Date.now() + 3000), // start 5s from creation
    },


    allowedBettingTill: {
      type: Date,
      default: function () {
        return new Date(this.startTime.getTime() + 20 * 1000); // 20s after start
      },
    },

    cashoutStartAt: {
      type: Date,
      default: function () {
        return new Date(this.allowedBettingTill.getTime() + 2 * 1000); // 20s after start
      },
    },
    endTime: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const rewardSession = mongoose.model("rewardsession", rewardSessionSchema);
export default rewardSession;
