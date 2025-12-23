require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const exists = await User.findOne({ username: "admin" });
    if (exists) {
      console.log("✅ Admin user already exists");
      process.exit(0);
    }

    const hashed = await bcrypt.hash("admin123", 10);

    await User.create({
      username: "admin",
      password: hashed,
    });

    console.log("🚀 Admin user created");
    console.log("👉 username: admin");
    console.log("👉 password: admin123");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
}

seedAdmin();
