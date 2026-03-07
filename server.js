require("dotenv").config();
const { Octokit } = require("@octokit/rest");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();

// REPLACE your current corsOptions with this:
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

//removed the thrailing slash

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use((req, res, next) => {
  if (req.path !== "/" && req.path.endsWith("/")) {
    const cleanPath = req.path.slice(0, -1);
    const query = req.url.slice(req.path.length); // preserve ?query=string
    return res.redirect(301, cleanPath + query);
  }
  next();
});

app.use(cors(corsOptions));// ← ADD THIS LINE — handles preflight for all routes
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(express.json({ limit: "10mb" }));

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";

// Create a MongoClient with enhanced DNS options
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  // family: 4, // Force IPv4 to help with DNS issues
  retryWrites: true,
  retryReads: true,
  maxPoolSize: 10,
  minPoolSize: 2,
});

// Database reference
let db;

// Connect to MongoDB once at startup
async function connectToDatabase() {
  try {
    console.log("🔄 Attempting to connect to MongoDB Atlas...");
    await client.connect();

    // Ping to confirm connection
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB!");

    // Set database
    db = client.db("skyup");
    console.log("✅ Database 'skyup' is ready!");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    console.error("\n🔧 Quick Fixes:");
    console.error("1. Check .env has: /skyup?retryWrites=true&w=majority");
    console.error("2. Verify internet connection");
    console.error("3. Try mobile hotspot if on Windows");
    console.error("4. Change DNS to 8.8.8.8 and restart computer\n");
    process.exit(1);
  }
}

// ============================================
// JWT AUTHENTICATION MIDDLEWARE
// ============================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error("❌ Token verification failed:", err.message);
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Login Route
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Get admin credentials from environment variables
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    const BLOGGER_EMAIL = process.env.BLOGGER_EMAIL;
    const BLOGGER_PASSWORD = process.env.BLOGGER_PASSWORD;

    let role = null;

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      role = "admin";
    } else if (email === BLOGGER_EMAIL && password === BLOGGER_PASSWORD) {
      role = "blogger";
    } else {
      console.log("❌ Invalid login attempt:", email);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { email, role, userId: role === "admin" ? "admin-1" : "blogger-1" },
      process.env.JWT_SECRET || "skyup-default-secret-change-in-production",
      { expiresIn: process.env.JWT_EXPIRES_IN || "24h" },
    );

    console.log("✅ Admin logged in successfully:", email);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        email: email,
        role: role,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

// Verify Token Route
app.get("/api/auth/verify", authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: req.user,
  });
});

// Logout Route (optional - mainly handled client-side)
app.post("/api/auth/logout", authenticateToken, (req, res) => {
  console.log("✅ User logged out:", req.user.email);
  res.json({ message: "Logged out successfully" });
});

// ============================================
// CLOUDINARY CONFIGURATION
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("File type not allowed"));
  },
});

function uploadToCloudinary(buffer, originalname) {
  return new Promise((resolve, reject) => {
    const safeName = originalname.replace(/\s+/g, "-");
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "skyup/resumes",
        resource_type: "auto",
        public_id: `${Date.now()}-${safeName}`,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    stream.end(buffer);
  });
}

// ============================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================

app.post("/resume", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const result = await uploadToCloudinary(
      req.file.buffer,
      req.file.originalname,
    );
    return res.json({
      message: "Uploaded successfully",
      url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type,
      bytes: result.bytes,
      format: result.format,
      originalname: req.file.originalname,
    });
  } catch (err) {
    console.error("Resume upload error:", err);
    return res
      .status(500)
      .json({ message: "Upload failed", error: err.message });
  }
});

app.post("/add-users", async (req, res) => {
  try {
    const users = {
      jobTitle: req.body.jobTitle || null,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      email: req.body.email,
      mobile: parseInt(req.body.mobile),
      street_address: req.body.street_address,
      city: req.body.city,
      state: req.body.state,
      zipcode: parseInt(req.body.zipcode),
      country: req.body.country,
      linkedin: req.body.linkedin || null,
      portfolio: req.body.portfolio || null,
      resumeUrl: req.body.resumeUrl || null,
      resumePublicId: req.body.resumePublicId || null,
      createdAt: new Date(),
    };

    await db.collection("jobs").insertOne(users);
    console.log("✅ User applied successfully");
    res.json({ message: "Applied successfully" });
  } catch (err) {
    console.error("❌ Add user error:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
});

app.post("/add-contact", async (req, res) => {
  try {
    const users = {
      name: req.body.name,
      email: req.body.email,
      mobile: parseInt(req.body.mobile),
      subject: req.body.subject,
      message: req.body.message,
      createdAt: new Date(),
    };

    await db.collection("contact").insertOne(users);
    console.log("✅ Contact submitted successfully");
    res.json({ message: "Submitted successfully" });
  } catch (err) {
    console.error("❌ Add contact error:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
});

// ============================================
// PROTECTED ROUTES (Authentication Required)
// ============================================

// Get all users (Protected)
app.get("/users", authenticateToken, async (req, res) => {
  try {
    const document = await db.collection("jobs").find({}).toArray();
    console.log(`✅ Fetched ${document.length} users by ${req.user.email}`);
    res.json(document);
  } catch (err) {
    console.error("❌ Get users error:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
});

// Get all contacts (Protected)
app.get("/contacts", authenticateToken, async (req, res) => {
  try {
    const document = await db.collection("contact").find({}).toArray();
    console.log(`✅ Fetched ${document.length} contacts by ${req.user.email}`);
    res.json(document);
  } catch (err) {
    console.error("❌ Get contacts error:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
});

// Get last invoice number (Protected)
app.get("/api/last-invoice", authenticateToken, async (req, res) => {
  try {
    const lastReceipt = await db
      .collection("receipt")
      .find()
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    if (lastReceipt.length > 0 && lastReceipt[0].invoice_no) {
      const invoiceNo = lastReceipt[0].invoice_no;
      const parts = invoiceNo.split("/");
      const serial = parseInt(parts[1], 10);

      res.json({ lastSerial: serial });
    } else {
      res.json({ lastSerial: 0 });
    }
  } catch (err) {
    console.error("❌ Error fetching last invoice:", err);
    res.status(500).json({ lastSerial: 0, error: err.message });
  }
});
// Update receipt (Protected)
app.put("/receipt/:id", authenticateToken, async (req, res) => {
  try {
    const receiptsCollection = db.collection("receipt");

    const safeParseNumber = (value, defaultValue = 0) => {
      const parsed = Number(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    const updatedFields = {
      to: req.body.to,
      client_gst: req.body.client_gst || "URD",
      date: new Date(req.body.date),
      invoice_due: req.body.invoice_due ? new Date(req.body.invoice_due) : null,
      hsn_no: req.body.hsn_no || "",
      items: req.body.items || [],
      subtotal: safeParseNumber(req.body.subtotal),
      amount_in_words: req.body.amount_in_words,
      cgst: safeParseNumber(req.body.cgst),
      sgst: safeParseNumber(req.body.sgst),
      igst: safeParseNumber(req.body.igst),
      cgst_percentage: safeParseNumber(req.body.cgst_percentage),
      sgst_percentage: safeParseNumber(req.body.sgst_percentage),
      igst_percentage: safeParseNumber(req.body.igst_percentage),
      total: safeParseNumber(req.body.total),
      updatedBy: req.user.email,
      updatedAt: new Date(),
    };

    const result = await receiptsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updatedFields },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    console.log(`✅ Receipt ${req.params.id} updated by ${req.user.email}`);
    res.json({ message: "Receipt updated successfully" });
  } catch (err) {
    console.error("❌ Update receipt error:", err);
    res
      .status(500)
      .json({ message: "Failed to update receipt", error: err.message });
  }
});

// Delete receipt (Protected)
app.delete("/receipt/:id", authenticateToken, async (req, res) => {
  try {
    const result = await db.collection("receipt").deleteOne({
      _id: new ObjectId(req.params.id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    console.log(`✅ Receipt ${req.params.id} deleted by ${req.user.email}`);
    res.json({ message: "Receipt deleted successfully" });
  } catch (err) {
    console.error("❌ Delete receipt error:", err);
    res
      .status(500)
      .json({ message: "Failed to delete receipt", error: err.message });
  }
});

// Create receipt (Protected)
// Create receipt (Protected)
app.post("/receipt", authenticateToken, async (req, res) => {
  try {
    const receiptsCollection = db.collection("receipt");
    const lastReceipt = await receiptsCollection
      .find()
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    let nextInvoiceSerial = 1;

    if (lastReceipt.length > 0) {
      const lastInvoice = lastReceipt[0].invoice_no;
      const invoiceParts = lastInvoice.split("/");
      nextInvoiceSerial = parseInt(invoiceParts[1], 10) + 1;
    }

    const getCurrentFinancialYear = () => {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      if (currentMonth >= 4) {
        return `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
      } else {
        return `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
      }
    };

    const financialYear = getCurrentFinancialYear();
    const paddedSerial = String(nextInvoiceSerial).padStart(3, "0");
    const invoiceNumber = `SDS/${paddedSerial}/${financialYear}`;

    // ✅ Helper function to safely parse numbers
    const safeParseNumber = (value, defaultValue = 0) => {
      const parsed = Number(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    const clients = {
      to: req.body.to,
      client_gst: req.body.client_gst || "URD",
      invoice_no: invoiceNumber,
      date: new Date(req.body.date),
      invoice_due: req.body.invoice_due ? new Date(req.body.invoice_due) : null,
      hsn_no: req.body.hsn_no,
      items: req.body.items || [],
      subtotal: safeParseNumber(req.body.subtotal, 0), // ✅ Changed
      amount_in_words: req.body.amount_in_words,
      cgst: safeParseNumber(req.body.cgst, 0), // ✅ Changed
      sgst: safeParseNumber(req.body.sgst, 0), // ✅ Changed
      igst: safeParseNumber(req.body.igst, 0), // ✅ Changed
      cgst_percentage: safeParseNumber(req.body.cgst_percentage, 0), // ✅ Changed
      sgst_percentage: safeParseNumber(req.body.sgst_percentage, 0), // ✅ Changed
      igst_percentage: safeParseNumber(req.body.igst_percentage, 0), // ✅ Changed
      total: safeParseNumber(req.body.total, 0), // ✅ Changed
      createdBy: req.user.email,
      createdAt: new Date(),
    };

    // ✅ Log the data being saved for debugging
    console.log(
      "📝 Receipt data to be saved:",
      JSON.stringify(clients, null, 2),
    );

    await receiptsCollection.insertOne(clients);
    console.log(`✅ Receipt submitted successfully by ${req.user.email}`);
    res.json({
      message: "Receipt submitted successfully",
      invoice_no: invoiceNumber,
    });
  } catch (err) {
    console.error("❌ Receipt error:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
});

// Get all receipts (Protected)
app.get("/receipts", authenticateToken, async (req, res) => {
  try {
    const document = await db.collection("receipt").find({}).toArray();
    console.log(`✅ Fetched ${document.length} receipts by ${req.user.email}`);
    res.json(document);
  } catch (err) {
    console.error("❌ Get receipts error:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
});

// Upload blog image to Cloudinary
app.post("/api/upload-blog-image", authenticateToken, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64)
      return res.status(400).json({ error: "No image provided" });

    // ✅ Reject images over 8MB
    const sizeInMB = (imageBase64.length * 0.75) / 1024 / 1024;
    if (sizeInMB > 8) {
      return res.status(400).json({
        error: `Image too large (${sizeInMB.toFixed(1)}MB). Please use an image under 8MB.`,
      });
    }

    const result = await cloudinary.uploader.upload(imageBase64, {
      folder: "skyup/blogs",
      resource_type: "image",
    });

    console.log(`✅ Blog image uploaded to Cloudinary: ${result.secure_url}`);
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error("❌ Blog image upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/publish-blog", authenticateToken, async (req, res) => {
  try {
    const { blogData } = req.body;

    if (!blogData || !blogData.slug) {
      return res
        .status(400)
        .json({ error: "Invalid blog data — slug is required." });
    }

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const path = process.env.BLOGS_FILE_PATH || "src/data/blogs.js";

    // 1. Fetch current blogs.js from GitHub
    let currentContent = "";
    let fileSha = null;

    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });
      currentContent = Buffer.from(data.content, "base64").toString("utf8");
      fileSha = data.sha;
    } catch (e) {
      if (e.status !== 404) throw e;
      currentContent = "export const BLOGS = [];\n";
    }

    // 2. Parse existing BLOGS array
    const match = currentContent.match(
      /export\s+const\s+BLOGS\s*=\s*(\[[\s\S]*\]);/,
    );
    let blogs = [];

    if (match) {
      try {
        blogs = new Function(`return ${match[1]}`)();
      } catch {
        return res.status(500).json({
          error: "Could not parse existing blogs.js — check file syntax.",
        });
      }
    }

    // 3. Insert or update blog
    const existingIndex = blogs.findIndex((b) => b.slug === blogData.slug);
    const newBlog = {
      ...blogData,
      id: existingIndex >= 0 ? blogs[existingIndex].id : Date.now(),
    };

    if (existingIndex >= 0) {
      blogs[existingIndex] = newBlog;
      console.log(`✅ Updated existing blog: ${blogData.slug}`);
    } else {
      blogs.unshift(newBlog);
      console.log(`✅ Added new blog: ${blogData.slug}`);
    }

    // 4. Serialize back to JS module
    const newContent = `export const BLOGS = ${JSON.stringify(blogs, null, 2)};\n`;

    // 5. Commit and push to GitHub
    const commitPayload = {
      owner,
      repo,
      path,
      branch,
      message: `blog: ${existingIndex >= 0 ? "update" : "add"} "${blogData.headline || blogData.slug}"`,
      content: Buffer.from(newContent).toString("base64"),
      committer: {
        name: "Blog Builder Bot",
        email: "bot@skyupdigital.com",
      },
    };

    if (fileSha) commitPayload.sha = fileSha;

    await octokit.repos.createOrUpdateFileContents(commitPayload);

    console.log(
      `✅ Blog "${blogData.slug}" pushed to GitHub by ${req.user.email}`,
    );

    res.json({
      message: `✅ Blog "${blogData.headline}" published and pushed to GitHub!`,
      slug: blogData.slug,
    });
  } catch (err) {
    console.error("❌ Publish error:", err);
    res.status(500).json({ error: err.message || "Failed to publish blog" });
  }
});

// Mask password in logs
const maskedUri = uri.replace(/:[^:@]+@/, ":****@");
console.log("🔗 MongoDB URI:", maskedUri);

// Graceful shutdown
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
const PORT = process.env.PORT || 3500;

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
