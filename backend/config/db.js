const mongoose = require("mongoose");

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MongoDB Atlas connection string is missing. Set MONGODB_URI in your environment.");
  }

  const connection = await mongoose.connect(mongoUri);
  console.log(`MongoDB connected: ${connection.connection.host}`);
};

module.exports = connectDB;
