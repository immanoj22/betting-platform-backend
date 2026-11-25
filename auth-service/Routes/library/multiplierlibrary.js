import crypto from "crypto";


export const multiplierCalculator = async (gameHash) => {
    let h = BigInt("0x" + gameHash.slice(0, 13));
    const e = 2n ** 52n;
    h = h % e;
    if (h % 33n === 0n) return 1.0;
    return Number((100n * e - h) / (e - h)) / 100;
};

export const getGameHash = async (serverSeed, publicSeed) => {
    const hmac = crypto.createHmac("sha256", serverSeed);
    hmac.update(`${publicSeed}`);
    return hmac.digest("hex");
};
