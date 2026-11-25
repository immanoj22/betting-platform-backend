import mongoose from "mongoose";

const gameConfigSchema = new mongoose.Schema(
  {
    gameType: {
      type: String,
      enum: ["crash", "coinflip", "chat"],
      required: true,
    },

    // Minimum amount user can bet
    minBetAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },

    // Maximum amount user can bet
    maxBetAmount: {
      type: Number,
      required: true,
      min: 1,
      default: 10000,
    },

    isEnabled: {
      type: Boolean,
      default: true,
    },

    // XP user earns per bet (for leveling system)
    xpPerBet: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    adminFee: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },
    xpForWinners: {
      type: Number,
      required: true,
      min: 0,
      default: 100,
    },
    vaultReserve: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

const gameConfig = mongoose.model("gameconfig", gameConfigSchema);
export default gameConfig;
