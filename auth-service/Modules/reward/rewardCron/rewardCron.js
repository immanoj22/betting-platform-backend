import userRewardSchema from "../model/userReward";
import { userWelcomeBonus } from "../hooks/rewardHooks";

export const userRewardCron=async()=>{
    try{
        // await userWelcomeBonus();
    }catch(err){
        console.log("__userRewardCron",err.message)
    }
}