require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectToDatabase } = require("./config/db");

// Route imports
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const contactRoutes = require("./routes/contactRoutes");
const receiptRoutes = require("./routes/receiptRoutes");
const blogRoutes = require("./routes/blogRoutes");

const app = express();

// ============================================
// CORS
// ============================================
const corsOptions = {
  origin: [
    "https://www.skyupdigitalsolutions.com",
    "https://skyupdigitalsolutions.com",
    "http://localhost:3000",
    "http://localhost:3001",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200,
};

// ============================================
// REMOVE TRAILING SLASHES
// ============================================
app.use((req, res, next) => {
  if (req.path !== "/" && req.path.endsWith("/")) {
    const cleanPath = req.path.slice(0, -1);
    const query = req.url.slice(req.path.length);
    return res.redirect(301, cleanPath + query);
  }
  next();
});

app.use(cors(corsOptions));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(express.json({ limit: "10mb" }));

// ============================================
// HEALTH CHECK
// ============================================
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ============================================
// ROUTES
// ============================================
app.use("/api/auth", authRoutes);
app.use("/", userRoutes);
app.use("/", contactRoutes);
app.use("/", receiptRoutes);
app.use("/", blogRoutes);

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3500;
const maskedUri = (process.env.MONGO_URI || "").replace(/:[^:@]+@/, ":****@");
console.log("🔗 MongoDB URI:", maskedUri);

connectToDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Ready to accept requests!`);
      console.log(`🔐 JWT Authentication enabled\n`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  });

module.exports = app;