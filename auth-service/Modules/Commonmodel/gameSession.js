import mongoose from "mongoose";

const gameSessionSchema = new mongoose.Schema(
  {
    gameType: {
      type: String, // crash, coinflip, airdrop, reward
      required: true,
    },
    status: {
      // BS-INFRA-005 fix: kept in sync with game-service's enum (which also
      // writes "initiate") — the two services share this collection.
      type: String,
      enum: ["initiate", "creating-onchain", "in-progress", "finished", "crashed", "accepting-Bets", "accepting-Bets-Ended"],
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
      // BS-INFRA-005 fix: aligned to game-service's 25s window (game-service
      // is the writer of this field).
      type: Date,
      default: function () {
        return new Date(this.startTime.getTime() + 25 * 1000);
      },
    },

    cashoutStartAt: {
      type: Date,
      default: function () {
        return new Date(this.allowedBettingTill.getTime() + 2 * 1000); // 20s after start
      },
    },

    result: {
      type: String,  //multipler for crash ,head or tail for coinflip
      default: ""
    },
    cashoutValidTill: {
      type: Date,
    },
    totalBetAmount: {
      type: Number,
      default: 0,
    },
    totalBetAmountUi: {
      type: Number,
      default: 0,
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

const GameSessionModel = mongoose.model("gamesession", gameSessionSchema);
export default GameSessionModel;
