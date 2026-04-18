const cloudinary = require("cloudinary").v2;
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
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

module.exports = { cloudinary, upload, uploadToCloudinary };