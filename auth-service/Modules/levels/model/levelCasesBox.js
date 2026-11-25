import mongoose from "mongoose";

const levelBox=new mongoose.Schema({
    levelName:{
        type:String,
        require:true
    },
    minXp:{
        type:Number,
        require:true
    },
    maxXp:{
        type:Number,
        require:true
    },
    minBetedAmount:{
        type:Number,
        require:true
    },
    minAccountBalance:{
        type:Number,
        require:true
    },
    boximage:{
        type:String,
        require:true,
        default:""
    }
})

const dailycasebox = mongoose.model("dailycasebox", levelBox,"dailycasebox");
export default dailycasebox;