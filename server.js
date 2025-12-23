require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const path = require("path");
const multer = require("multer");
const axios = require("axios");

const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const User = require("./models/User");
const Image = require("./models/Image");

const app = express();

/* =========================
   MongoDB
========================= */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

/* =========================
   Cloudinary
========================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* =========================
   Multer Storage
========================= */
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "uploads",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = multer({ storage });

/* =========================
   Middleware
========================= */
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static("public"));

/* =========================
   JWT AUTH MIDDLEWARE
========================= */
function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect("/login");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.redirect("/login");
  }
}

/* =========================
   LOGIN PAGE
========================= */
app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

/* =========================
   LOGIN HANDLER
========================= */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) {
    return res.render("login", { error: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.render("login", { error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user._id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "strict",
  });

  res.redirect("/");
});

/* =========================
   LOGOUT
========================= */
app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

/* =========================
   UPLOAD PAGE (/)
========================= */
app.get("/", requireAuth, (req, res) => {
  res.render("index");
});

/* =========================
   UPLOAD IMAGE
========================= */
app.post("/upload", requireAuth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.redirect("/");

    const originalName = path.parse(req.file.originalname).name;

    const image = new Image({
      originalName,
      publicId: req.file.filename || req.file.public_id,
      url: req.file.path,
    });

    await image.save();

    res.redirect("/gallery");
  } catch (err) {
    console.error("Upload error:", err);
    res.redirect("/");
  }
});

/* =========================
   GALLERY
========================= */
app.get("/gallery", requireAuth, async (req, res) => {
  const images = await Image.find().sort({ createdAt: -1 });
  res.render("gallery", { images });
});

/* =========================
   DELETE IMAGE
========================= */
app.post("/delete", requireAuth, async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) return res.redirect("/gallery");

    await cloudinary.uploader.destroy(public_id);
    await Image.findOneAndDelete({ publicId: public_id });

    res.redirect("/gallery");
  } catch (err) {
    console.error("Delete error:", err);
    res.redirect("/gallery");
  }
});

/* =========================
   RENAME IMAGE
========================= */
app.post("/rename", requireAuth, async (req, res) => {
  try {
    const { id, newName } = req.body;

    if (!id || !newName) {
      return res.redirect("/gallery");
    }

    await Image.findByIdAndUpdate(id, {
      originalName: newName.trim(),
    });

    res.redirect("/gallery");
  } catch (err) {
    console.error("Rename error:", err);
    res.redirect("/gallery");
  }
});

/* =========================
   DOWNLOAD IMAGE
========================= */
app.get("/download/:id", requireAuth, async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) return res.redirect("/gallery");

    const response = await axios({
      url: image.url,
      method: "GET",
      responseType: "stream",
    });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${image.originalName}.jpg"`
    );
    res.setHeader("Content-Type", "image/jpeg");

    response.data.pipe(res);
  } catch (err) {
    console.error("Download error:", err);
    res.redirect("/gallery");
  }
});

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 4021;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
