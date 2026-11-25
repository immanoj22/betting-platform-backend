import express from "express";
import passport from "passport";
import * as oauthController from "../controller/oauthController.js";
import {
  restoreToken,
  linkOAuthSession,
  requireLinkedSession,
  userAuthorization,
} from "../../../middleware/Authentications/userAuthentication.js";

const router = express.Router();

//google
// BS-AUTH-010 fix: the client must first hit this authenticated
// (Authorization-header) endpoint to link its session — no JWT travels via
// URL query string anywhere in this flow anymore.
router.post("/oauth_login_google_init", userAuthorization, linkOAuthSession);

// Start Google Login (popup) — relies on the session established above.
router.get(
  "/oauth_login_google",
  requireLinkedSession,
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth callback
router.get(
  "/oauth_login_google_callback",restoreToken,userAuthorization,
  passport.authenticate("google", { failureRedirect: "/login_failed" }),
  oauthController.googlePopupCallback
);


// router.get("/twitter_login",userAuthorization,
//   passport.authenticate("twitter", {
//     scope: ["tweet.read", "users.read"],
//   })
// );

// router.get(
//   "/twitter_callback",userAuthorization,
//   passport.authenticate("twitter", { failureRedirect: "/login" }),
//   oauthController.twitterCallback
// );


// // Telegram Login (opens popup / redirect)
router.post("/telegram_login", userAuthorization,oauthController.telegramLogin);

router.post("/telegram_join_group_check",userAuthorization,oauthController.telegramJoinCheck)
// router.get(
//   "/telegram_callback",
//   oauthController.telegramCallback
// );




export default router;
