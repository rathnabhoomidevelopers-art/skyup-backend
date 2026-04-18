const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  retryReads: true,
  maxPoolSize: 10,
  minPoolSize: 2,
});

let db;

async function connectToDatabase() {
  try {
    console.log("🔄 Attempting to connect to MongoDB...");
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB!");
    db = client.db("skyup");
    console.log("✅ Database 'skyup' is ready!");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

function getDb() {
  if (!db) throw new Error("Database not initialized. Call connectToDatabase() first.");
  return db;
}

process.on("SIGINT", async () => {
  try {
    await client.close();
    console.log("\n✅ MongoDB connection closed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during shutdown:", err);
    process.exit(1);
  }
});

module.exports = { connectToDatabase, getDb };