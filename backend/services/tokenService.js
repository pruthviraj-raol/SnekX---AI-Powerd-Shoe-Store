const jwt = require("jsonwebtoken");

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return process.env.JWT_SECRET;
};

const generateToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );

module.exports = {
  generateToken,
  getJwtSecret,
};
