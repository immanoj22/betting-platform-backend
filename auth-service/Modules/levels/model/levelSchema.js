import mongoose from "mongoose";

const levelSchema=new mongoose.Schema({
    levelNumber:{
        type:Number,
        default:1
    },
    minXp:{
        type:Number,
        require:true
    },
    maxXp:{
        type:Number,
        require:true
    }
})

const levelConfig = mongoose.model("levels", levelSchema);
export default levelConfig;