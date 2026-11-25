import User from "../../Modules/User-service/model/UserSchema.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import config from "../../config.js";

export const userAuthorization = async (req, res, next) => {
  try {
    authTokenVerification(req, res, next);
  } catch (err) {
    console.log("UserAuthorization-error", err);
    return res
      .status(401)
      .json({ statusCode: 401, success: false, message: "Invalid Token" });
  }
};

export const authTokenVerification = async (req, res, next) => {
  try {
    // BS-AUTH-010 fix: no longer accepts the token via `?token=` query
    // string — a URL-carried token leaks into server logs, browser
    // history, and Referer headers. Every real caller sends it as an
    // Authorization header.
    // BS-FE-003 support: also accept the httpOnly `authToken` cookie set on
    // login, as an additional (not yet primary) identity channel.
    const authHeader = req.headers.authorization || req.cookies?.authToken;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No authorization token provided",
      });
    }

    const token = authHeader.replace(/^Bearer\s*/, "").trim();
    console.log(token, "token");
    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    // BS-AUTH-009 fix: `userUuid` was never in the JWT payload or the User
    // schema, so this clause was a dead no-op — removed rather than kept as
    // vestigial dead code. Identity is resolved by the unique walletAddress.
    const user = await User.findOne({
      walletAddress: decoded.walletAddress,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.token?.replace(/^Bearer\s*/, "") !== token) {
      return res.status(401).json({
        success: false,
        message: "Token mismatch — please log in again",
      });
    }
    // 5️⃣ Attach minimal user info to request
    req.user = user;
    console.log("userCame");
    next();
  } catch (err) {
    console.error("authTokenVerification__err:", err);
    return res.status(500).json({
      success: false,
      message: "Server error verifying token",
    });
  }
};

export const restoreToken = (req, res, next) => {
  if (req.session?.clientToken) {
    req.headers.authorization = req.session.clientToken;
  }
  next();
};

// BS-AUTH-010 fix (full close): the session JWT no longer travels via a
// `?token=` URL query param at any point. `linkOAuthSession` is hit first,
// as an authenticated (Authorization-header) request, and stores the token
// in the server-side session — the session cookie (httpOnly, already
// configured in server.js) is what then carries identity across the
// Google redirect, not the token itself. `requireLinkedSession` is a
// guard so the OAuth flow can't even start without that session already
// present.
export const linkOAuthSession = (req, res) => {
  try {
    if (!req.headers.authorization) {
      return res.status(401).json({
        success: false,
        message: "Authorization header required",
      });
    }
    if (req.session) {
      req.session.clientToken = req.headers.authorization;
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("linkOAuthSession error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error saving session",
    });
  }
};

export const requireLinkedSession = (req, res, next) => {
  if (!req.session?.clientToken) {
    return res.status(401).json({
      success: false,
      message: "No linked session — call the init endpoint first",
    });
  }
  next();
};
