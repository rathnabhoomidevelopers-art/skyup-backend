const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  // Fail fast instead of hanging 30s on a bad/blocked connection
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 20000,
  retryWrites: true,
  retryReads: true,
  maxPoolSize: 10,
  minPoolSize: 0, // serverless: don't pre-open connections on cold start
});

let db;
let connectPromise = null; // cache the in-flight/established connection

// Idempotent: returns the SAME promise on warm invocations, so we connect once.
function connectToDatabase() {
  if (db) return Promise.resolve(db);
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    console.log("🔄 Connecting to MongoDB...");
    await client.connect(); // no extra admin ping on the hot path
    db = client.db("skyup");
    console.log("✅ MongoDB connected, database 'skyup' ready");
    return db;
  })().catch((error) => {
    // Reset so the next request can retry — do NOT kill the process on serverless
    connectPromise = null;
    console.error("❌ MongoDB connection failed:", error.message);
    throw error;
  });

  return connectPromise;
}

function getDb() {
  if (!db) throw new Error("Database not initialized. Call connectToDatabase() first.");
  return db;
}

process.on("SIGINT", async () => {
  try {
    await client.close();
    console.log("\n✅ MongoDB connection closed");
  } finally {
    process.exit(0);
  }
});

module.exports = { connectToDatabase, getDb };
