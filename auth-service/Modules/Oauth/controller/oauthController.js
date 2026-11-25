import passport from "passport";
import TwitterStrategy from "@superfaceai/passport-twitter-oauth2";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import crypto from "crypto";
import axios from "axios";
import config from "../../../config.js";
import UserSchema from "../../User-service/model/UserSchema.js";
import { sendResponse } from "../../../service/response.js";
import jwt from "jsonwebtoken"
// ================== PASSPORT SERIALIZE ==================
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// ================== GOOGLE STRATEGY ==================
export const setupGoogleStrategy = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        callbackURL: config.GOOGLE_CALLBACK_URL,
        passReqToCallback: true, // important to access req.session
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const user = await UserSchema.findOne({ _id: req.user._id });

          // // 2️⃣ Link Google account if not already linked
          const existing = user.oAuthLinkedAccounts.find(acc => acc.platform === "google");
          if (!existing) {
            user.oAuthLinkedAccounts.push({
              platform: "google",
              userId: profile.id,
              email: profile.emails?.[0]?.value || "",
              firstName: profile.name?.givenName || "",
              lastName: profile.name?.familyName || "",
              accessToken,
            });
            await user.save();
          }

          done(null, user);
        } catch (err) {
          console.log("Catch_err", err.message)
          done(err, null);
        }
      }
    )
  );
};


// BS-AUTH-010 fix: never broadcast the session JWT / balances to an
// unrestricted target origin. postMessage now targets the configured
// frontend origin explicitly, and the payload is reduced to non-sensitive
// display fields only — no `token`, no balances.
const oauthTargetOrigin =
  config?.FRONTEND_URL || config?.FRONTURL || config?.APIURL || "";

const toSafeOAuthPayload = (user) => ({
  walletAddress: user?.walletAddress,
  user: user?.user,
  oAuthLinkedAccounts: (user?.oAuthLinkedAccounts || []).map((acc) => ({
    platform: acc.platform,
    email: acc.email,
    firstName: acc.firstName,
    lastName: acc.lastName,
  })),
});

export const googlePopupCallback = (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      console.warn("googlePopupCallback: No user found in req.user");
      return res.send(`
        <html>
          <body>
            <script>
              window.opener?.postMessage(
                { type: "GOOGLE_OAUTH_ERROR" },
                ${JSON.stringify(oauthTargetOrigin)}
              );
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    return res.send(`
      <html>
        <body>
          <script>
            window.opener?.postMessage(
              { type: "GOOGLE_OAUTH_SUCCESS", user: ${JSON.stringify(toSafeOAuthPayload(user))} },
              ${JSON.stringify(oauthTargetOrigin)}
            );
            window.close();
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("googlePopupCallback error:", err);

    return res.send(`
      <html>
        <body>
          <script>
            window.opener?.postMessage(
              { type: "GOOGLE_OAUTH_ERROR" },
              ${JSON.stringify(oauthTargetOrigin)}
            );
            window.close();
          </script>
        </body>
      </html>
    `);
  }
};



// ================== TWITTER STRATEGY ==================
// export const setupTwitterStrategy = () => {
//   passport.use(
//     new TwitterStrategy(
//       {
//         clientID: config.TWITTER_CLIENT_ID,
//         clientSecret: config.TWITTER_CLIENT_SECRET,
//         clientType: "confidential",
//         callbackURL: config.TWITTER_CALLBACK_URL,
//         scope: ["tweet.read", "users.read", "offline.access"]
//       },
//       async (accessToken, refreshToken, profile, done) => {
//         try {
//           let user = await UserSchema.findOne({ "oAuthLinkedAccounts.userId": profile.id });
//           if (!user) {
//             user = new UserSchema({
//               name: profile.username,
//               oAuthLinkedAccounts: [{
//                 platform: "twitter",
//                 userId: profile.id,
//                 username: profile.username,
//                 accessToken,
//                 refreshToken,
//               }]
//             });
//             await user.save();
//           }
//           done(null, user);
//         } catch (err) {
//           done(err, null);
//         }
//       }
//     )
//   );
// };

// export const twitterCallback = (req, res) => {
//   const user = req.user;
//   return sendResponse(res, {
//     statusCode: 200,
//     success: true,
//     message: "Twitter login successful",
//     result: user,
//   });
// };


export const telegramLogin = async (req, res) => {
  try {
    const telegramData = req.body;
    const { hash, ...data } = telegramData;

    const checkString = Object.keys(data)
      .sort()
      .map(key => `${key}=${String(data[key])}`)
      .join("\n");

    const secretKeyHex = crypto
      .createHash("sha256")
      .update(config.TELEGRAM_BOT_TOKEN)
      .digest("hex");

    const hmac = crypto
      .createHmac("sha256", Buffer.from(secretKeyHex, "hex"))
      .update(checkString, "utf-8")
      .digest("hex");

    if (hmac !== hash) {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        message: "Invalid Telegram login",
      });
    }

    const telegramUserId = telegramData.id;

    const existingLink = await UserSchema.findOne({
      "oAuthLinkedAccounts.userId": telegramUserId,
      "oAuthLinkedAccounts.platform": "telegram",
    });

    if (existingLink && existingLink._id.toString() !== req.user._id.toString()) {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        message: "This Telegram account is already linked to another user",
      });
    }

    const groupUsername = "@YourGroupName";
    const groupResponse = await axios.get(
      `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/getChatMember`,
      { params: { chat_id: groupUsername, user_id: telegramUserId } }
    );

    const status = groupResponse.data.result.status;
    const joined = ["member", "administrator", "creator"].includes(status);

    const user = await UserSchema.findOne({ _id: req.user._id });
    if (!user) {
      return sendResponse(res, {
        statusCode: 404,
        success: false,
        message: "User not found",
      });
    }

    const existing = user.oAuthLinkedAccounts.find(acc => acc.platform === "telegram");

    if (existing) {
      existing.userId = telegramData.id;            // Telegram user ID
      existing.username = telegramData.username || "";
      existing.firstName = telegramData.first_name || "";
      existing.lastName = telegramData.last_name || "";
      existing.email = telegramData.email || "";
      existing.isJoinedGroup = joined;             // true/false from group check
      existing.hash = hash;                         // optional, store for record
      existing.linkedAt = new Date();              // update timestamp
    } else {
      user.oAuthLinkedAccounts.push({
        platform: "telegram",
        userId: telegramData.id,
        username: telegramData.username || "",
        firstName: telegramData.first_name || "",
        lastName: telegramData.last_name || "",
        email: telegramData.email || "",
        isJoinedGroup: joined,
        hash: hash,
        linkedAt: new Date()
      });
    }

    await user.save();

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Telegram login successful",
      result: { user: telegramData, joinedGroup: joined },
    });

  } catch (err) {
    console.error("Telegram login error:", err);
    return sendResponse(res, {
      statusCode: 500,
      success: false,
      message: "Telegram login failed",
      errors: err.message,
    });
  }
};

export const telegramJoinCheck = async (req, res) => {
  try {
    const { telegramUserId } = req.body;

    if (!telegramUserId) {
      return res.status(400).json({
        success: false,
        message: "telegramUserId is required",
      });
    }

    const BOT_TOKEN = config.TELEGRAM_BOT_TOKEN;
    const GROUP_ID = config.TELEGRAM_GROUP_ID;

    if (!BOT_TOKEN || !GROUP_ID) {
      return res.status(500).json({
        success: false,
        message: "Bot token or group ID missing in env",
      });
    }

    // Telegram API
    const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${GROUP_ID}&user_id=${telegramUserId}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    console.log("getChatMember response:", data);

    if (!data.ok) {
      return res.status(200).json({
        success: true,
        joined: false,
        message: "Telegram API error or user not found",
      });
    }

    const status = data.result.status;
    const joined = ["member", "administrator", "creator"].includes(status);

    // If not joined → no DB update
    if (!joined) {
      return res.status(200).json({
        success: true,
        joined: false,
        status,
      });
    }

    // ⭐ USER JOINED — UPDATE DATABASE
    const updateResult = await UserSchema.updateOne(
      {
        "oAuthLinkedAccounts.platform": "telegram",
        "oAuthLinkedAccounts.userId": telegramUserId
      },
      {
        $set: {
          "oAuthLinkedAccounts.$.isJoinedGroup": true
        }
      }
    );

    console.log("DB Update:", updateResult);

    return res.status(200).json({
      success: true,
      joined: true,
      status,
      message: "User joined group & updated in DB",
    });

  } catch (error) {
    console.error("telegramJoinCheck error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};




