import rewardSession from "../../reward/model/rewardSession";
import RewardConfig from "../../reward/model/rewardConfig";
import { payAirdropWinners } from "../hooks/airDropHook";


export const AirDropMainFunctioningCron = async (io) => {
    try {
        const config = await RewardConfig.findOne({
            rewardFor: "airDrop",
            isEnabled: true
        });

        if (!config) {
            // console.log("No active airdrop config found");
            return;
        }

        const unfinishedSessions = await rewardSession.find({
            gameType: "airDrop",
            endTime: { $lte: new Date() },
            status: { $ne: "finished" }
        });

        for (const session of unfinishedSessions) {
            try {
                const updated = await rewardSession.findOneAndUpdate(
                    { _id: session._id, status: { $ne: "finished" } },
                    { $set: { status: "distributing-rewards" } },
                    { new: true }
                );

                if (updated) {
                    io.emit("airDrop:status:update", {
                        id: session._id,
                        status: "distrubuting reward",
                        data: updated
                    });
                    await payAirdropWinners(session._id,io);

                    const finishingdata=await rewardSession.findOneAndUpdate(
                        { _id: session._id },
                        { $set: { status: "finished" } }
                    );
                    io.emit("airDrop:status:update", {
                        id: session._id,
                        status: "finished",
                        data: finishingdata
                    });
                }
            } catch (err) {
                console.log("Reward distribution failed:", err.message, session._id);
            }
        }

        const now = new Date();

        const runningAirDrop = await rewardSession.findOne({
            gameType: "airDrop",
            endTime: { $gte: now },
            status: { $in: ["creating-onchain", "accepting-Tip", "accepting-Tip-Ended"] }
        });

        if (runningAirDrop) {
            const startTime = new Date(runningAirDrop.startTime);
            const allowedBetTill = new Date(runningAirDrop.allowedBettingTill);
            const endTime = new Date(runningAirDrop.endTime);

            if (startTime <= now && runningAirDrop.status === "creating-onchain") {
                const data = await rewardSession.findOneAndUpdate(
                    { _id: runningAirDrop._id },
                    { $set: { status: "accepting-Tip" } },
                    { new: true }
                );
                io.emit("airDrop:status:update", {
                    id: runningAirDrop._id,
                    status: "accepting-Tip",
                    data: data
                });
            }

            else if (allowedBetTill <= now && runningAirDrop.status === "accepting-Tip") {
                const data = await rewardSession.findOneAndUpdate(
                    { _id: runningAirDrop._id },
                    { $set: { status: "accepting-Tip-Ended" } },
                    { new: true }
                );
                io.emit("airDrop:status:update", {
                    id: runningAirDrop._id,
                    status: "accepting-Tip-Ended",
                    data: data
                });
            }

            else if (endTime <= now && runningAirDrop.status === "accepting-Tip-Ended") {
                const data = await rewardSession.findOneAndUpdate(
                    { _id: runningAirDrop._id, status: "accepting-Tip-Ended" },
                    { $set: { status: "distributing-rewards" } },
                    { new: true }
                );
                io.emit("airDrop:status:update", {
                    id: runningAirDrop._id,
                    status: "distrubuting reward",
                    data: data
                });
                await payAirdropWinners(runningAirDrop._id,io);
                const finishingdata = await rewardSession.findOneAndUpdate(
                    { _id: runningAirDrop._id },
                    { $set: { status: "finished" } },
                    { new: true }
                );
                io.emit("airDrop:status:update", {
                    id: runningAirDrop._id,
                    status: "finished",
                    data: finishingdata
                });
            }

            return;
        }


        const startTime = new Date(now.getTime() + 3000);
        const allowedBettingTill = new Date(startTime.getTime() + config.distributionInSeconds * 1000);
        const endTime = new Date(allowedBettingTill.getTime() + 3000);

        const newSession = await rewardSession.create({
            gameType: "airDrop",
            startTime,
            allowedBettingTill,
            endTime,
            status: "creating-onchain"
        });

        await RewardConfig.findOneAndUpdate(
            { rewardFor: "airDrop", isEnabled: true },
            { $set: { lastRun: now, nextRun: endTime } }
        );

        io.emit("new:airDrop:session", {
            status: true,
            message: "New AirDrop session created",
            data: newSession
        });

        console.log("New Airdrop session created:", newSession._id);

    } catch (err) {
        console.log("Airdrop Cron Error:", err);
        io.emit("socket:error", {
            status: false,
            message: "Airdrop creation error",
            error: err.message
        });
    }
};
