const User = require("../models/User");
const asyncHandler = require("../middleware/asyncHandler");
const { generateToken } = require("../services/tokenService");

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
});

const getBlockedAccountMessage = (status) => {
  if (status === "inactive") {
    return "Your account has been deactivated.";
  }

  if (status === "banned") {
    return "Your account has been blocked.";
  }

  return null;
};

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email, and password are required.");
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    res.status(409);
    throw new Error("User already exists with this email.");
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: "user",
  });

  res.status(201).json({
    success: true,
    message: "Registration successful.",
    token: generateToken(user),
    user: sanitizeUser(user),
  });
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required.");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password.");
  }

  const blockedAccountMessage = getBlockedAccountMessage(user.status);

  if (blockedAccountMessage) {
    res.status(403);
    throw new Error(blockedAccountMessage);
  }

  res.json({
    success: true,
    message: "Login successful.",
    token: generateToken(user),
    user: sanitizeUser(user),
  });
});

const getProfile = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: sanitizeUser(req.user),
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const nextName = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const nextEmail = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";

  if (!nextName || !nextEmail) {
    res.status(400);
    throw new Error("Name and email are required.");
  }

  const existingUser = await User.findOne({
    email: nextEmail,
    _id: { $ne: req.user._id },
  });

  if (existingUser) {
    res.status(409);
    throw new Error("Another user already uses this email address.");
  }

  req.user.name = nextName;
  req.user.email = nextEmail;

  const updatedUser = await req.user.save();

  res.json({
    success: true,
    message: "Profile updated successfully.",
    user: sanitizeUser(updatedUser),
  });
});

module.exports = {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
};
