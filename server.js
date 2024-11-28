require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();

const mongoose = require("mongoose");
const Image = require("./models/Image"); // Import the Image model

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer and Cloudinary storage setup
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "uploads",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});

const upload = multer({ storage });

// Middleware
app.set("view engine", "ejs");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Routes

// Home route for uploading images
app.get("/", (req, res) => {
  res.render("index");
});

// Upload image route
app.post("/upload", upload.single("image"), async (req, res) => {
  if (req.file) {
    try {
      // Extract the original file name
      const originalName = path.parse(req.file.originalname).name;

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        public_id: `uploads/${originalName}`, // Use original name as public_id
        overwrite: true, // Overwrite if it already exists
      });

      // Save to MongoDB
      const image = new Image({
        originalName: originalName, // Original file name
        publicId: result.public_id, // Cloudinary public_id
        url: result.secure_url, // Cloudinary URL
      });
      await image.save();

      res.render("uploaded", {
        imageUrl: result.secure_url,
        imageName: originalName,
      });
    } catch (error) {
      console.error(
        "Error uploading to Cloudinary or saving to MongoDB:",
        error
      );
      res.status(500).send("Upload failed.");
    }
  } else {
    res.status(400).send("No file uploaded.");
  }
});

// Gallery route to display uploaded images
app.get("/gallery", async (req, res) => {
  try {
    // Fetch images from MongoDB
    const images = await Image.find().sort({ createdAt: -1 });

    // Pass images to the gallery template
    res.render("gallery", { images });
  } catch (error) {
    console.error("Error fetching images from MongoDB:", error);
    res.status(500).send("Error loading gallery.");
  }
});

// Delete image route
app.post("/delete", async (req, res) => {
  try {
    const { public_id } = req.body;

    if (!public_id) {
      return res.status(400).send("Public ID is required.");
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(public_id);

    // Delete from MongoDB
    await Image.findOneAndDelete({ publicId: public_id });

    res.status(200).send("Image deleted successfully.");
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).send("Error deleting image.");
  }
});

// Start the server
const PORT = process.env.PORT || 4021;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
