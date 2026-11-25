import rateLimit from "express-rate-limit";
import { sendResponse } from "./response";

// BS-INFRA-003 fix: this limiter previously existed but was never applied to
// any route. General-purpose brake for all API traffic.
export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendResponse(res, {
      status: false,
      statusCode: 200,
      message: "Rate limit exceeded 🚫",
    });
  },
});

// Tighter limiter for login/auth and fund-moving endpoints specifically.
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendResponse(res, {
      status: false,
      statusCode: 200,
      message: "Rate limit exceeded 🚫",
    });
  },
});
