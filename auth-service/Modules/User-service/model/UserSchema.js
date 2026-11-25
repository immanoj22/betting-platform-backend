import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import crypto, { hash } from "crypto";
import { v4 as uuidv4 } from "uuid";

// ---------- WORD LISTS ----------
const adjectives = [
  "Lucky",
  "Swift",
  "Bold",
  "Brave",
  "Fierce",
  "Silent",
  "Mighty",
  "Crypto",
  "Golden",
  "Wild",
  "Sharp",
  "Epic",
  "Crazy",
  "Sly",
  "Blazing",
  "Clever",
  "Dark",
  "Fearless",
  "Electric",
  "Glorious",
  "Nimble",
  "Savage",
  "Rapid",
  "Wicked",
  "Chill",
  "Hyper",
  "Frozen",
  "Stealth",
  "Turbo",
  "Loyal",
  "Phantom",
  "Cosmic",
  "Atomic",
  "Ultra",
  "Nova",
  "Viral",
  "Tricky",
  "Sneaky",
  "Radiant",
  "Vivid",
  "Legendary",
  "Crimson",
  "Iron",
  "Obsidian",
  "Mystic",
  "Vortex",
  "Inferno",
  "Aqua",
  "Cyber",
];

const animals = [
  "Tiger",
  "Wolf",
  "Lion",
  "Eagle",
  "Bear",
  "Fox",
  "Panther",
  "Hawk",
  "Shark",
  "Bull",
  "Falcon",
  "Dragon",
  "Cobra",
  "Jaguar",
  "Rhino",
  "Viper",
  "Leopard",
  "Raven",
  "Puma",
  "Cougar",
  "Owl",
  "Cheetah",
  "Scorpion",
  "Kraken",
  "Phoenix",
  "Bison",
  "Crocodile",
  "Gorilla",
  "Raptor",
  "Stallion",
  "Hydra",
  "Anaconda",
  "Wolverine",
  "Komodo",
  "Lynx",
  "Mamba",
  "Hornet",
  "Griffin",
  "Serpent",
  "Turtle",
  "Penguin",
  "Husky",
  "Dolphin",
  "Moth",
  "Spider",
  "Goat",
  "Monkey",
  "Ram",
];

// ---------- GENERATORS ----------
function generateNickName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const ani = animals[Math.floor(Math.random() * animals.length)];
  const tag = Math.floor(1000 + Math.random() * 9000);
  return `${adj}${ani}${tag}`;
}

function generateClientSeed(length = 30) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

// ---------- OAUTH SUBSCHEMA ----------
const OAuthAccountSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ["telegram", "google", "discord", "x"],
    required: true,
  },
  userId: { type: String, default: "" },
  username: { type: String, default: "" },
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  email: { type: String, default: "" },
  accessToken: { type: String, default: "" },
  linkedAt: { type: Date, default: Date.now },
  hash: { type: String, default: "" },
  isJoinedGroup: { type: Boolean, default: false },
});

// ---------- MAIN USER SCHEMA ----------
const UserSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true, unique: true, trim: true },
    instawalletbalance: { type: Number, default: 0 },
    instawalletEnable: { type: Boolean, default: false },
    // internal UUID for user (like Solpump's user field)
    user: { type: String, unique: true },
    role: { type: String, default: "user" },
    // public display name
    nickName: { type: String, unique: true },

    //cleint email
    email: { type: String, default: "" },

    // client seed (unique)
    clientSeed: { type: String, unique: true },

    // referral code (derived from nickName)
    referralCode: { type: String, unique: true },
    referredBy: { type: String, default: "" },
    token: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Logged_In", "Logged_Out", "WALLET_CONFIRMATION_REQUIRED"],
      default: "WALLET_CONFIRMATION_REQUIRED",
    },
    nounce: { type: Number, default: 0 },
    overAllVolume: { type: Number, default: 100 },
    totalWageredAmount: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
    profileImage: { type: String, default: "" },
    xpMarker: { type: Number, default: 0 },
    oAuthLinkedAccounts: { type: [OAuthAccountSchema], default: [] },
  },
  { timestamps: true },
);

// ---------- UNIQUE FIELD AUTO-GENERATION ----------
UserSchema.pre("save", async function (next) {
  try {
    // --- user UUID ---
    if (!this.user) {
      let id,
        exists = true;
      while (exists) {
        id = uuidv4();
        exists = await mongoose.models.User.findOne({ user: id });
      }
      this.user = id;
    }

    // --- nickname ---
    if (!this.nickName) {
      let nick,
        exists = true;
      while (exists) {
        nick = generateNickName();
        exists = await mongoose.models.User.findOne({ nickName: nick });
      }
      this.nickName = nick;
    }

    // --- client seed ---
    if (!this.clientSeed) {
      let seed,
        exists = true;
      while (exists) {
        seed = generateClientSeed();
        exists = await mongoose.models.User.findOne({ clientSeed: seed });
      }
      this.clientSeed = seed;
    }

    // --- referral code ---
    if (!this.referralCode) {
      let ref,
        exists = true;
      while (exists) {
        ref = this.nickName
          ? this.nickName.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
          : crypto.randomBytes(3).toString("hex").toUpperCase();

        exists = await mongoose.models.User.findOne({ referralCode: ref });
        if (exists) ref = ref + Math.floor(Math.random() * 1000);
      }
      this.referralCode = ref;
    }

    next();
  } catch (err) {
    console.error("Error generating unique fields:", err);
    next(err);
  }
});

// ---------- JWT METHODS ----------
UserSchema.methods.generateJWT = function () {
  const payload = {
    walletAddress: this.walletAddress,
    user: this.user,
    state: this.status,
  };
  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET || process.env.SECRET_KEY,
    { expiresIn: "7d" },
  );
  this.token = token;
  return `Bearer ${token}`;
};

UserSchema.statics.decodeJWT = function (token) {
  return jwt.verify(
    token.replace(/^Bearer\s*/, ""),
    process.env.JWT_SECRET || process.env.SECRET_KEY,
  );
};

export default mongoose.model("User", UserSchema);
