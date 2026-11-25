import mongoose from "mongoose";

const BetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "newgames",
      required: true,
    },
    betamount: {
      type: Number,
      required: true,
    },
    betamountUI: {
      type: Number,
      required: true,
    },
    inPlayamount: {
      type: Number,
      required: true,
    },
    inPlayamountUI: {
      type: Number,
      required: true,
    },
    profitamount: {
      type: Number,
      required: true,
    },
    profitamountUI: {
      type: Number,
      required: true,
    },
    transactionHash: {
      type: String,
      required: true,
    },
    side: {
      //for coin flip only
      type: String,
      enum: ["HIGH", "LOW"],
    },
    // coinFlipgamestatus:{
    //     type: String,
    //     enum: ["won", "lost","in-play"],
    //     default:"in-play"
    // },
    autoCashOut: {
      //for crash only
      type: Number,
      default: 0,
    },
    progressCashOutPercentage: {
      //crash game
      type: Number,
      default: 0,
    },
    gameStatus: {
      //final status of the bet-coin flip/crash
      type: String,
      enum: ["in-play", "cashed", "busted"],
      default: "in-play",
    },
    profitLossAmount: {
      type: Number,
      required: true,
    },
    isFromInstaWallet: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);
const BetModel = mongoose.model("bets", BetSchema);
export default BetModel;
