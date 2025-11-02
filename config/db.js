const { MongoClient } = require("mongodb");

const uri = "mongodb://127.0.0.1:27017" ;
const client = new MongoClient(uri);

async function connectDB() {
  try {
    await client.connect();
    console.log("✅ MongoDB connected successfully!");
    return client.db("Zing-Zephyr");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}

module.exports = connectDB;

