const mongoose = require("mongoose");
const { MONGO_URI } = require("./env");

async function connectMongo() {
  mongoose.set("strictQuery", true);

  // Recommended options for production stability:
  // - autoIndex should be false in production (create indexes via migrations / manual ops)
  // In development it's ok to keep true.
  const isProd = process.env.NODE_ENV === "production";

  await mongoose.connect(MONGO_URI, {
    autoIndex: !isProd,
  });

  console.log("mongoDb connected");
}

module.exports = { connectMongo };
