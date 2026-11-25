import { model ,Schema } from "mongoose";

const poolDetailSchema = new Schema({
  totalSupply: { type: Number, default: 0 },       // Total LP tokens
  currentSupply: { type: Number, default: 0 },     // Available liquidity
  rewardRate: { type: Number, default: 0.0001 },   // 0.01% = 0.0001
  totalFeesCollected: { type: Number, default: 0 }, // Total trade fees
  burnpercentage : { type : Number , default : 0}
}, { timestamps: true });

export default model("pooldetails",poolDetailSchema,"pooldetails")