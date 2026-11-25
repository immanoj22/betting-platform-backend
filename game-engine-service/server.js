/** Core Packages */
import express from "express";
import http from "http";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";

import config from "./config.js";
import { connect } from "./service/connection.js";

import v1 from "./Routes/versions/v1.js";

import { Server } from "socket.io";
import { handleCrashGameSession } from "./Modules/Game-service/crashGame/crashCronService/crashCronService.js";
import { crashsubscribeChannel } from "./Modules/Game-service/crashGame/redis pub-sub/crash/crashsubcriber/crashSubscriber.js";
// import { subscribeChannel } from "./service/redis/subscribers/redisSubscriber.js";
import { coinsubscribeChannel } from "./Modules/Game-service/coinFlip/redis pub-sub/coinflip/coinFlipsubcriber/coinFlipSubcriber.js";
import CrashEngine from "./Modules/Game-service/crashGame/crashGameEngineClass/crashGameEngineClass.js";
import { pendingCashOutPay } from "./service/cron.js";

export const app = express();

// BS-INFRA-002 fix: explicit allow-list instead of an unrestricted origin.
const allowedOrigins = [
  config?.FRONTURL,
  config?.FRONTEND_URL,
  config?.ADMIN_URL,
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : []),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(helmet());

app.use(helmet.crossOriginEmbedderPolicy(false));
app.use(helmet.frameguard({ action: "deny" }));
app.use(helmet.hidePoweredBy());
app.use(helmet.noSniff());
app.use(helmet.xssFilter());
app.use(helmet.referrerPolicy({ policy: "no-referrer" }));
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  }),
);
app.use(
  helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  }),
);
app.use(
  helmet({
    permissionsPolicy: {
      features: {
        camera: ["none"],
        microphone: ["none"],
        geolocation: ["self"],
      },
    },
  }),
);

/** JSON & File Upload */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(mongoSanitize());
app.use(fileUpload());
app.set("trust proxy", true);
app.use("/", express.static(path.join(__dirname, "assets")));

app.use("/api", v1);

app.use("/", (req, res) => {
  res.send("game_service_running");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

//all subcriber
crashsubscribeChannel();
coinsubscribeChannel();
pendingCashOutPay();

const INTERVAL_MS = 100;

const engine = new CrashEngine(handleCrashGameSession, 100);
engine.start();

// cron.schedule("*/1 * * * * *", async () => {
//    pendingCashOutPay()
// });

server.listen(config.PORT, async (err) => {
  if (err) {
    console.error("Server failed to start:", err);
    process.exit(1);
  }
  await connect();
});
