require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();

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
      const originalName = path.parse(req.file.originalname).name;

      const result = await cloudinary.uploader.upload(req.file.path, {
        public_id: `uploads/${originalName}`,
        overwrite: true,
      });

      res.render("uploaded", {
        imageUrl: result.secure_url,
        imageName: originalName,
      });
    } catch (error) {
      console.error("Error uploading to Cloudinary:", error);
      res.status(500).send("Upload failed.");
    }
  } else {
    res.status(400).send("No file uploaded.");
  }
});

// Gallery route to display uploaded images
app.get("/gallery", async (req, res) => {
  try {
    const resources = await cloudinary.search
      .expression("folder:uploads")
      .sort_by("public_id", "desc")
      .max_results(30)
      .execute();

    const images = resources.resources.map((file) => ({
      url: file.secure_url,
      name: path.parse(file.public_id).name, // Extract the original file name
      public_id: file.public_id,
    }));

    res.render("gallery", { images });
  } catch (error) {
    console.error("Error fetching gallery:", error);
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

    await cloudinary.uploader.destroy(public_id);
    res.status(200).send("Image deleted successfully.");
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).send("Error deleting image.");
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
