import Redis from "ioredis";
import { cashoutgameBet, placegameBet } from "../../../hooks/crashBetHandler";
import { fetchOnLiveGameData } from "../../../hooks/commonGamehook";
import { crashPubliser } from "../crashpubliser/crashPubliser";

const subscriber = new Redis();

export const crashsubscribeChannel = async () => {
    try {
        subscriber.subscribe("crash:place:bet");
        subscriber.subscribe("crash:place:cashout");
        subscriber.subscribe("crash:game:recentState")

        subscriber.on("message", async (channel, message) => {
            let data
            // BS-INFRA-007 fix: JSON.parse must be inside the try/catch —
            // this callback's own try/catch (below) previously didn't cover
            // it, so one malformed publish was an unhandled rejection.
            try {
                if (message) {
                    data = JSON.parse(message);
                }
            } catch (parseErr) {
                console.log("crashSubscriber malformed message:", parseErr.message);
                return;
            }


            if (channel === "crash:place:bet") {

                const userId = data.userDetails._id.toString();
                
                const result = await placegameBet(data);
                result.userId = userId
                if (!result.status) {
                    return await crashPubliser("crash:user:notification", result)
                }
                const liveData = await fetchOnLiveGameData()
                console.log("🚀 ~ crashsubscribeChannel ~ liveData:", liveData)
                await crashPubliser("crash:user:notification", result)
                await crashPubliser("crash:game:update", liveData)
                return;
            }

            if (channel === "crash:place:cashout") {

                const userId = data.userDetails._id.toString();
                const result = await cashoutgameBet(data);
                result.userId = userId
                if (!result.status) {
                    return await crashPubliser("crash:user:notification", result)
                }
                const liveData = await fetchOnLiveGameData()
                await crashPubliser("crash:user:notification", result)
                return await crashPubliser("crash:game:update", liveData)
            }

            if (channel === "crash:game:recentState") {
                const liveData = await fetchOnLiveGameData()
                return await crashPubliser("crash:game:data", liveData)
            }


        });

    } catch (err) {
        console.log("Subscriber error:", err.message);
    }
};
