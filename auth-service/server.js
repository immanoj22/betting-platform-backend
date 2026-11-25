/** Core Packages */
import express from "express";
import http from "http";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import session from "express-session";
import passport from "passport";
import cron from "node-cron";
import { Server } from "socket.io";
import mongoSanitize from "express-mongo-sanitize";
/** Internal Imports */
import Admin from "./Modules/Admin-service/Router/adminRoute.js";
import config from "./config.js";
import { connect } from "./service/connection.js";
import v1 from "./Routes/versions/v1.js";
import { registerSocketIO } from "./socket/index.js";
import { subscribeChannel } from "./service/redis/subscribers/redisSubscriber.js";
import { AirDropMainFunctioningCron } from "./Modules/airDrop/airDropCronService/airDropCron.js";
import { userRewardCron } from "./Modules/reward/rewardCron/rewardCron.js";
import { setupGoogleStrategy } from "./Modules/Oauth/controller/oauthController.js";
import {
  getTokenPriceFromContract,
  getUsdPriceOfSol,
} from "./Modules/Dex/Hook/tokenPriceCron.js";
import { buyAndBurn } from "./Modules/Dex/Hook/burnCron.js";
import { limiter } from "./service/rateLimit.js";

const app = express();

app.use((req, res, next) => {
  console.log("vanakkam1111111111111111111111-->");
  next();
});

/* ---------------------------------------------------
   TRUST PROXY
--------------------------------------------------- */
// app.set("trust proxy", true);

/* ---------------------------------------------------
   CORS (SVG SAFE)
--------------------------------------------------- */
// BS-INFRA-002 fix: an explicit allow-list instead of a wildcard origin,
// since this middleware also sets credentials:true.
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
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

/* ---------------------------------------------------
   SECURITY HEADERS (ORDER MATTERS)
--------------------------------------------------- */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  }),
);

// Explicitly allow cross-origin images (SVG FIX)
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  console.log("vanakkam-->");
  next();
});

// Content Security Policy (SVG SAFE)
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      connectSrc: [
        "'self'",
        "http://localhost:5174/",
        // "https://api.yourdomain.com",
        // "https://rpc.solana.com"
      ],
      fontSrc: ["'self'", "data:"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  }),
);

// Other Helmet protections
app.use(helmet.frameguard({ action: "deny" }));
app.use(helmet.hidePoweredBy());
app.use(helmet.noSniff());
app.use(helmet.referrerPolicy({ policy: "no-referrer" }));
app.use(
  helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  }),
);

/* ---------------------------------------------------
   BODY & FILE PARSERS
--------------------------------------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(mongoSanitize());
app.use(cookieParser());
app.use(fileUpload());

/* ---------------------------------------------------
   SVG MIME TYPE FIX
--------------------------------------------------- */
app.use((req, res, next) => {
  if (req.url.endsWith(".svg")) {
    res.type("image/svg+xml");
  }
  next();
});

/* ---------------------------------------------------
   STATIC FILES (SVG SAFE)
--------------------------------------------------- */
app.use("/", express.static(path.join(__dirname, "assets")));

/* ---------------------------------------------------
   SESSION & PASSPORT
--------------------------------------------------- */
app.use(
  session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      // BS-INFRA-004 fix: secure in every environment except local dev (no
      // HTTPS locally).
      secure: process.env.NODE_ENV !== "local",
      httpOnly: true,
      // BS-AUTH-010 fix support: the OAuth-link flow (see
      // Modules/Oauth/router/router.js) stores state in this session via a
      // cross-origin fetch from the frontend, then reads it back after a
      // top-level popup navigation. `None` (paired with `secure`, required
      // by browsers) makes that reliable whether the frontend and API are
      // same-site or fully cross-site. Local dev has no HTTPS, so it stays
      // on `lax` (the browser default) there.
      sameSite: process.env.NODE_ENV !== "local" ? "none" : "lax",
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// Passport strategies
setupGoogleStrategy();

/* ---------------------------------------------------
   ROUTES
--------------------------------------------------- */
app.use("/api", limiter, v1);
app.use("/admin", limiter, Admin);

app.get("/", (req, res) => {
  res.send("user_service_running");
});

/* ---------------------------------------------------
   HTTP + SOCKET.IO
--------------------------------------------------- */
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

registerSocketIO(io);

/* ---------------------------------------------------
   CRON JOBS (LOCKED)
--------------------------------------------------- */
let isAirDropRunning = false;
let isRewardRunning = false;

cron.schedule("*/1 * * * * *", async () => {
  if (isAirDropRunning) return;
  isAirDropRunning = true;
  try {
    await AirDropMainFunctioningCron(io);
  } catch (err) {
    console.error("[AIRDROP CRON ERROR]", err);
  } finally {
    isAirDropRunning = false;
  }
});

cron.schedule("*/1 * * * *", async () => {
  getUsdPriceOfSol();
});

cron.schedule("*/5 * * * *", () => {
  getTokenPriceFromContract();
});

cron.schedule("*/30 * * * *", () => {
  console.log("Runs once every half an hours ");
  buyAndBurn();
});

cron.schedule("*/1 * * * * *", async () => {
  if (isRewardRunning) return;
  isRewardRunning = true;
  try {
    await userRewardCron();
  } catch (err) {
    console.error("[REWARD CRON ERROR]", err);
  } finally {
    isRewardRunning = false;
  }
});

/* ---------------------------------------------------
   SERVER START
--------------------------------------------------- */
server.listen(config.PORT, async (err) => {
  if (err) {
    console.error("Server failed to start:", err);
  }
  connect();
  subscribeChannel(io);
  getUsdPriceOfSol();
  console.log(`🚀 Server running on port ${config.PORT}`);
});
