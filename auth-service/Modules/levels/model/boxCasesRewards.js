import mongoose from "mongoose";
const boxCasesRewardsSchema=new mongoose.Schema({
    boxCaseId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"dailycasebox",
        required:true
    },
    minProbalityPercentage:{
        type:Number,
        required:true
    },
    maxProbalityPercentage:{
        type:Number,
        required:true
    },
    assetType:{
        type:String,
        enum:["token","sol","xp"],
        required:true
    },
    assetAmount:{
        type:Number,
        required:true
    }
})
export const boxCasesRewards=mongoose.model("boxrewards",boxCasesRewardsSchema);