import crypto from 'crypto'

export const publicSeedGeneration = async () => {
    const clientSeed = crypto.randomBytes(32).toString("hex");
    return clientSeed;
}

export const serverSeedGeneration = async () => {
    const serverSeed = crypto.randomBytes(32).toString('hex');
    return serverSeed;
}
// export const getNonce = async () => {
//     const count = await CrashMultiplierModel.countDocuments();
//     return count;
// };
