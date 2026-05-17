const User = require("../models/User");

const ensureDefaultAdmin = async () => {
  const email = process.env.DEFAULT_ADMIN_EMAIL;
  const password = process.env.DEFAULT_ADMIN_PASSWORD;

  if (!email || !password) {
    return;
  }

  const existingAdmin = await User.findOne({ email: email.toLowerCase() });
  if (existingAdmin) {
    return;
  }

  await User.create({
    name: process.env.DEFAULT_ADMIN_NAME || "SnekX Admin",
    email: email.toLowerCase(),
    password,
    role: "admin",
  });

  console.log(`Default admin created for ${email}`);
};

module.exports = {
  ensureDefaultAdmin,
};
