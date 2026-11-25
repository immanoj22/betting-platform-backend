import jwt from "jsonwebtoken";
import config from "../../config.js";
import UserSchema from "../../Modules/Game-service/comonModel/UserSchema.js"

export const userAuthorization = async (req, res, next) => {
    try {
            const token = req.header("Authorization").split("Bearer ").join("");
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
    // BS-AUTH-010 fix: no `?token=` query-string fallback — a URL-carried
    // token leaks into logs/history/Referer headers.
    // BS-FE-003 support: also accept the httpOnly `authToken` cookie set by
    // auth-service on login (requires COOKIE_DOMAIN to be configured to a
    // shared parent domain in any multi-subdomain deployment).
    const authHeader = req.headers.authorization || req.cookies?.authToken;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No authorization token provided",
      });
    }

    const token = authHeader.replace(/^Bearer\s*/, "").trim();


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
    // schema — dead no-op clause, removed.
    const user = await UserSchema.findOne({
      walletAddress: decoded.walletAddress,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    console.log("user",user)
    if (user.token?.replace(/^Bearer\s*/, "") !== token) {
      return res.status(401).json({
        success: false,
        message: "Token mismatch — please log in again",
      });
    }

    // 5️⃣ Attach minimal user info to request
    req.user = user

    next();
  } catch (err) {
    console.error("authTokenVerification__err:", err);
    return res.status(500).json({
      success: false,
      message: "Server error verifying token",
    });
  }
};