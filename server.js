require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();

const corsOptions = {
  origin: [
    "https://www.skyupdigitalsolutions.com",
    "https://skyupdigitalsolutions.com",
    "http://localhost:3000",
  ], 
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"], // Added Authorization
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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
  family: 4, // Force IPv4 to help with DNS issues
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
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Get admin credentials from environment variables
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@skyupdigitalsolutions.com";
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

    // Validate email
    if (email !== ADMIN_EMAIL) {
      console.log("❌ Invalid email attempt:", email);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Validate password
    if (password !== ADMIN_PASSWORD) {
      console.log("❌ Invalid password attempt for:", email);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        email: email,
        role: "admin",
        userId: "admin-1" 
      },
      process.env.JWT_SECRET || "skyup-default-secret-change-in-production",
      { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
    );

    console.log("✅ Admin logged in successfully:", email);
    
    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        email: email,
        role: "admin"
      }
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
    user: req.user 
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
      }
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
    const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);
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
    return res.status(500).json({ message: "Upload failed", error: err.message });
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
      const parts = invoiceNo.split('/');
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

// Create receipt (Protected)
app.post("/receipt", authenticateToken, async (req, res) => {
  try {
    const receiptsCollection = db.collection("receipt");
    const lastReceipt = await receiptsCollection.find().sort({ createdAt: -1 }).limit(1).toArray();
    
    let nextInvoiceSerial = 1;

    if (lastReceipt.length > 0) {
      const lastInvoice = lastReceipt[0].invoice_no;
      const invoiceParts = lastInvoice.split('/');
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
    const paddedSerial = String(nextInvoiceSerial).padStart(3, '0');
    const invoiceNumber = `SDS/${paddedSerial}/${financialYear}`;

    const clients = {
      to: req.body.to,
      invoice_no: invoiceNumber,
      date: new Date(req.body.date),
      invoice_due: req.body.invoice_due || null,
      hsn_no: req.body.hsn_no,
      description: req.body.description,
      qty: parseInt(req.body.qty),
      rate: parseInt(req.body.rate),
      amount: parseInt(req.body.amount),
      amount_in_words: req.body.amount_in_words,
      cgst: parseInt(req.body.cgst || req.body.gst9),
      sgst: parseInt(req.body.sgst || req.body.Gst9),
      total: parseInt(req.body.total),
      createdBy: req.user.email, // Track who created the receipt
      createdAt: new Date(),
    };

    await receiptsCollection.insertOne(clients);
    console.log(`✅ Receipt submitted successfully by ${req.user.email}`);
    res.json({ message: "Receipt submitted successfully", invoice_no: invoiceNumber });
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

// ============================================
// SERVER SETUP
// ============================================

// Mask password in logs
const maskedUri = uri.replace(/:[^:@]+@/, ':****@');
console.log("🔗 MongoDB URI:", maskedUri);

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await client.close();
    console.log('\n✅ MongoDB connection closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
});

// Start server only after successful DB connection
connectToDatabase().then(() => {
  app.listen(3500, () => {
    console.log(`🚀 Server running at http://127.0.0.1:3500`);
    console.log(`📡 Ready to accept requests!`);
    console.log(`🔐 JWT Authentication enabled\n`);
  });
}).catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});