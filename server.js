require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { MongoClient } = require("mongodb");

const app = express();

const corsOptions = {
  origin: "https://skyup-digital.vercel.app", // Replace with your actual frontend URL
  methods: ["GET", "POST"],  // Adjust as needed
  allowedHeaders: ["Content-Type"], // Adjust based on headers your API needs
  preflightContinue: false,
};

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const connectionString = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
    ];
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

    const client = await MongoClient.connect(connectionString);
    const database = client.db("skyup");

    await database.collection("jobs").insertOne(users);
    await client.close();

    console.log("Applied successfully!..");
    res.json({ message: "Applied successfully" });
  } catch (err) {
    console.error("Add user error:", err);
    res.status(500).json({ message: "Failed", error: err.message });
  }
});

app.get("/users", async (req, res) => {
  try {
    const client = await MongoClient.connect(connectionString);
    const database = client.db("skyup");

    const document = await database.collection("jobs").find({}).toArray();
    await client.close();

    res.json(document);
  } catch (err) {
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

    const client = await MongoClient.connect(connectionString);
    const database = client.db("skyup");

    await database.collection("contact").insertOne(users);
    await client.close();

    console.log("Submitted successfully!..");
    res.json({ message: "Submitted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed", error: err.message });
  }
});

app.get("/contacts", async (req, res) => {
  try {
    const client = await MongoClient.connect(connectionString);
    const database = client.db("skyup");

    const document = await database.collection("contact").find({}).toArray();
    await client.close();

    res.json(document);
  } catch (err) {
    res.status(500).json({ message: "Failed", error: err.message });
  }
});
console.log("MONGO URI IN USE:", connectionString);

app.listen(3500, () => {
  console.log(`Server running at http://127.0.0.1:3500`);
});
