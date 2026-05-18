const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getJwtSecret } = require("../services/tokenService");

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.split(" ")[1];
};

const attachUser = async (req, token) => {
  const decoded = jwt.verify(token, getJwtSecret());
  const user = await User.findById(decoded.id).select("-password");

  if (!user) {
    throw new Error("User not found");
  }

  req.user = user;
};

const getBlockedAccountMessage = (status) => {
  if (status === "inactive") {
    return "Your account has been deactivated.";
  }

  if (status === "banned") {
    return "Your account has been blocked.";
  }

  return null;
};

const protect = async (req, res, next) => {
  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({ success: false, message: "Not authorized. Token missing." });
    }

    await attachUser(req, token);

    const blockedAccountMessage = getBlockedAccountMessage(req.user.status);

    if (blockedAccountMessage) {
      return res.status(403).json({ success: false, message: blockedAccountMessage });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Not authorized. Invalid token." });
  }
};

const optionalProtect = async (req, _res, next) => {
  try {
    const token = getTokenFromHeader(req);
    if (token) {
      await attachUser(req, token);
    }
  } catch (error) {
    req.user = null;
  }

  next();
};

module.exports = {
  protect,
  optionalProtect,
};
