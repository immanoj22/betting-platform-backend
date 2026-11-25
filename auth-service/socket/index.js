// import { initCrashGameNamespace } from "./crashSockets/crashGameMainlogic.js";
// import { initCrashBetAndCashoutNamespace } from "./crashSockets/crashBetAndCashout.js";
// import { initNewCoinFlip } from "./coinflipSockets/coinflipMainSocket.js";
// import { initchatUser } from "./chatSockets/chatSocket.js";

import initMainSocket from "./commonsocketFile/mainSocketFile";


export const registerSocketIO = (io) => {
    // initCrashGameNamespace(io)
    // initCrashBetAndCashoutNamespace(io)
    // initNewCoinFlip(io)
    // initchatUser(io)
    // initcoinFLipPuclicGameNamespace(io)
    initMainSocket(io)
};