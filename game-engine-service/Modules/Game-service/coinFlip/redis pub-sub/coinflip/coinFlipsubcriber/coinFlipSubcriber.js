import Redis from "ioredis";
import {
  placeNewCoinFlipGame,
  placeOppositeBotCoinFlipBet,
  placeOppositeCoinFlipBet,
} from "../../../hooks/coinFlipHandlerHook";
import { flipGameDetails } from "../../../hooks/commonGamehook";
import { coinPubliser } from "../coinFlippubliser/coinFlipPublisher";
// import { cashoutgameBet, placegameBet } from "../../../hooks/crashBetHandler";
// import { fetchOnLiveGameData, flipGameDetails } from "../../../hooks/commonGamehook";
// import { crashPubliser } from "../crashpubliser/crashPubliser";
// import { placeNewCoinFlipGame } from "../../../hooks/coinFlipHandlerHook";

const subscriber = new Redis();

export const coinsubscribeChannel = async () => {
  try {
    console.log("subscriber is listening");

    subscriber.subscribe("game:coin:newFlip");
    subscriber.subscribe("game:coin:oppositeFlip");
    subscriber.subscribe("game:coin:oppositeFlipBot");

    subscriber.on("message", async (channel, message) => {
      let data;
      // BS-INFRA-007 fix: guard the parse so a malformed publish can't
      // become an unhandled rejection that crashes the service.
      try {
        if (message) {
          data = JSON.parse(message);
        }
      } catch (parseErr) {
        console.log("coinFlipSubcriber malformed message:", parseErr.message);
        return;
      }

      if (channel === "game:coin:newFlip") {
        console.log("game:coin:newFlip:data-->", data);
        const result = await placeNewCoinFlipGame(data);
        console.log("coinFlip:user:notification", result);
        if (!result.status) {
          return await coinPubliser("coinFlip:user:notification", {
            status: result?.status,
            message: result.message,
            userId: result?.userId,
          });
        }

        const gameDetails = await flipGameDetails(result.NewGame.gamesession);

        await coinPubliser("coinFlip:user:notification", gameDetails);
        await coinPubliser("coinFlip:game:newgame", gameDetails);
        await coinPubliser("user:notify", gameDetails);
        return;
      }

      if (channel === "game:coin:oppositeFlip") {
        console.log(data);
        await placeOppositeCoinFlipBet(data);
        return;
      }

      if (channel === "game:coin:oppositeFlipBot") {
        console.log("game:coin:oppositeFlipBot-->");
        await placeOppositeBotCoinFlipBet(data);
        return;
      }
    });
  } catch (err) {
    console.log("Subscriber error:", err.message);
  }
};
