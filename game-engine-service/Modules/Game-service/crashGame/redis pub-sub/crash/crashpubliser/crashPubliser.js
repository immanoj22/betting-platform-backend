import Redis from "ioredis";

const Publishers=new Redis();

export const crashPubliser = async (channel, data) => {
    try {
        const msg = typeof data === "string" ? data : JSON.stringify(data);

        const result = await Publishers.publish(channel, msg);

        if (result === 0) {
            console.log("WARNING: No subscriber is listening on this channel!");
        }
        return result;

    } catch (err) {
        console.log("__crashPublisers err:", err.message);
    }
};