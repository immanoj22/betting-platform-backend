import { PublicKey } from "@solana/web3.js";
import { serverSeedGeneration } from "../../../library/seedGenratorlibrary";
import { UserServerSeeds } from "../model/UserSeed";
import { getGameHash } from "../../../library/multiplierlibrary";
import UserSchema from "../model/UserSchema";

export const isValidSolanaAddress = (address) => {
  try {
    const pubkey = new PublicKey(address); // will throw error if invalid
    const isValid = PublicKey.isOnCurve(pubkey.toBuffer()); // extra curve check
    return isValid;
  } catch (err) {
    return false;
  }
};

export const createNewUserServerSeed = async (user) => {
  try {
    const isActiveSeedExist = await UserServerSeeds.findOne({ userId: user._id, isActive: true });
    if (isActiveSeedExist) {
      return {status:false,message:"Active server seed already exists for this user"};
    }
    const serverSeed = await serverSeedGeneration();
    const hashedServerSeed=await getGameHash(serverSeed)
    const newUserServerSeed = new UserServerSeeds({
      userId: user._id,
      serverSeed: serverSeed,
      hashedServerSeed: hashedServerSeed,
      userNounce:user.nounce
    });
    await newUserServerSeed.save();
    return {status:true,message:"New server seed created successfully",data:newUserServerSeed};
  } catch (err) {
    console.error("createNewUserServerSeed error:", err);
    throw err;
  }
}

export const deactivateUserSeed = async (userID, seedID) => {
  try {
    const seed = await UserServerSeeds.findOne({ _id: seedID, userId: userID, isActive: true });
    if (!seed) {
      return {status:false,message:"Active server seed not found for this user"};
    }

    if(seed.numberOfTimeUsed < 1){
      return {status:false,message:"Server seed cannot be deactivated before being used"};
    }
    seed.isActive = false;
    await seed.save();
    return {status:true,message:"Server seed deactivated successfully"};
  } catch (err) {
    console.error("deactivateUserServerSeed error:", err);
    throw err;
  }
}