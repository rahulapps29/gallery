const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema({
  originalName: { type: String, required: true }, // Original file name
  publicId: { type: String, required: true }, // Cloudinary public_id
  url: { type: String, required: true }, // Cloudinary URL
  createdAt: { type: Date, default: Date.now }, // Timestamp
});

module.exports = mongoose.model("Image", ImageSchema);
