import mongoose from "mongoose";

const userServerSeedsSchema=new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"users",
        required:true
    },
    serverSeed:{
        type:String,
        required:true
    },
    hashedServerSeed:{
        type:String,
        required:true
    },
    numberOfTimeUsed:{
        type:Number,
        default:0
    },
    userNounce:{
        type:Number,
        require:true,
        default:0
    },
    isActive:{
        type:Boolean,
        default:true
    }
},{
    timestamps:true
});

export const UserServerSeeds=mongoose.model("userServerSeeds",userServerSeedsSchema);   