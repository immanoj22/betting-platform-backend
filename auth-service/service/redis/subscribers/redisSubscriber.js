import Redis from "ioredis";
import UserSchema from "../../../Modules/User-service/model/UserSchema";
import config from "../../../config";

const redisOptions = {
  ...(config.REDIS_HOST ? { host: config.REDIS_HOST } : {}),
  ...(config.REDIS_PORT ? { port: Number(config.REDIS_PORT) } : {}),
  ...(config.REDIS_PASSWORD ? { password: config.REDIS_PASSWORD } : {}),
  ...(config.REDIS_USERNAME ? { username: config.REDIS_USERNAME } : {}),
  ...(config.REDIS_TLS === "true" ? { tls: {} } : {}),
  ...(config.REDIS_DB ? { db: Number(config.REDIS_DB) } : {}),
  ...(config.REDIS_KEY_PREFIX ? { keyPrefix: config.REDIS_KEY_PREFIX } : {}),
};

const subscriber = new Redis(redisOptions);
const publisher = new Redis(redisOptions);
export const subscribeChannel = async (io) => {
  try {
    subscriber.subscribe("crash:user:notification");
    subscriber.subscribe("crash:game:update");
    subscriber.subscribe("crash:game:data");
    subscriber.subscribe("crash:game:new");

    subscriber.subscribe("coinFlip:user:notification");
    subscriber.subscribe("coinFlip:game:update");
    subscriber.subscribe("coinFlip:game:newgame");

    //user
    subscriber.subscribe("User:Get:Request");
    subscriber.subscribe("user:notify");

    subscriber.on("message", async (channel, message) => {
      const data = JSON.parse(message);

      //crash
      const nsp = io;
      const publicNsp = io;

      if (channel === "crash:user:notification") {
        if (!data.status) {
          return nsp.to(data.userId).emit("crash:bet:error", data);
        }
        return nsp.to(data.userId).emit("crash:bet:success", data);
      }

      if (channel === "crash:game:update") {
        if (!data.status) {
          return nsp.to(data.userId).emit("crash:error", data);
        }
        return publicNsp.emit("crash:change", {
          CurrentTime: new Date(),
          Crash: data,
        });
      }

      if (channel === "crash:game:data") {
        if (!data) {
          return publicNsp.emit("crash:error", {
            CurrentTime: new Date(),
            Crash: data,
          });
        }

        if (data.status === "creating-onchain") {
          return publicNsp.emit("crash:new", {
            CurrentTime: new Date(),
            Crash: data,
          });
        } else {
          return publicNsp.emit("crash:change", {
            CurrentTime: new Date(),
            Crash: data,
          });
        }
      }

      if (channel === "crash:game:new") {
        return publicNsp.emit("crash:new", {
          CurrentTime: new Date(),
          Crash: data,
        });
      }

      //coinFilp
      const coinFlippublic = io;
      const coinFlipPrivate = io;

      if (channel === "coinFlip:user:notification") {
        if (!data.status) {
          return coinFlipPrivate
            .to(data.userId)
            .emit("coinFlip:bet:error", data);
        }
        return coinFlipPrivate
          .to(data.userId)
          .emit("coinFlip:bet:success", data);
      }

      if (channel === "coinFlip:game:update") {
        if (!data.status) {
          return coinFlipPrivate.to(data.userId).emit("coinFlip:error", data);
        }
        return coinFlippublic.emit("coinFlip:change", data);
      }

      if (channel === "coinFlip:game:newgame") {
        if (!data.status) {
          return coinFlippublic.emit("coinFlip:error", data);
        }
        return coinFlippublic.emit("coinFlip:newgame", data);
      }

      if (channel === "User:Get:Request") {
        const { details, requestId } = JSON.parse(message);

        try {
          const user = await UserSchema.findOne(details).lean();

          publisher.publish(
            `User:Get:Response:${requestId}`,
            JSON.stringify({ status: true, user }),
          );
        } catch (e) {
          publisher.publish(
            `User:Get:Response:${requestId}`,
            JSON.stringify({ status: false, error: e.message }),
          );
        }
      }

      if (channel === "user:notify") {
        return coinFlipPrivate.to(data.userId).emit("user:notify", {});
      }
    });
  } catch (err) {
    console.log("Subscriber error:", err.message);
  }
};
