import { v4 as uuid } from "uuid";
import Redis from "ioredis";

const pub = new Redis();
const sub = new Redis();

export function getUserDetailsViaPubSub(details) {
  return new Promise((resolve, reject) => {
    const requestId = uuid();
    const responseChannel = `User:Get:Response:${requestId}`;

    // Listen for this specific response
    sub.subscribe(responseChannel, () => {
      
      // Ask user-service for user
      pub.publish(
        "User:Get:Request",
        JSON.stringify({ details, requestId })
      );
    });

    sub.on("message", (channel, message) => {
      if (channel === responseChannel) {
        const data = JSON.parse(message);

        sub.unsubscribe(responseChannel);

        if (data.status === false) return reject(data.error);
        resolve(data.user);
      }
    });
  });
}
