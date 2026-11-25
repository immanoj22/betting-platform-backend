import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const liquiditySchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },

    amount0: {
      type: String,
      required: true,
      default: "0",
    },

    amount1: {
      type: String,
      required: true,
      default: "0",
    },

    value: {
      type: String,
      required: true,
      default: "0",
    },

    apy : {
      type : String ,
      default : "0"
    },

    feeGenerated: {
      type: String, 
      default: "0",
    },

    lpTokens: {
      type: String,
      default: "0",
      index: true,
    },

    feeClaimed : {
      type : String,
      default : "0",
      index:true
    },

    status: {
      type: String,
      enum: ["active", "withdrawn"],
      default: "active",
      index: true,
    },

    rewardId : {
      type : String , 
      default : ""
    },

    txHash : { 
      type : String ,
      default : ""
    }
  },
  {
    timestamps: true,
  }
);

liquiditySchema.statics.getPoolTVL = async function () {
  return this.aggregate([
    {
      $match : {
        status : "active"
      }
    },
    {
      $group: {
        _id: null,
        total0: { $sum: { $toDecimal: "$amount0" } },
        total1: { $sum: { $toDecimal: "$amount1" } },
      },
    },
  ]);
};


export default model("Liquidity", liquiditySchema, "liquidity");
