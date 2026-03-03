// backend.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;

const app = express();
const PORT = process.env.PORT || 4000;

const BACKEND_DIR = __dirname;
const POSTS_FILE = path.join(BACKEND_DIR, "posts.json");
const JOBS_FILE = path.join(BACKEND_DIR, "jobs.json");

// ================= CLOUDINARY CONFIG =================
cloudinary.config({
  cloud_name: "YOUR_CLOUD_NAME",    // Replace with your Cloudinary cloud name
  api_key: "YOUR_API_KEY",          // Replace with your Cloudinary API key
  api_secret: "YOUR_API_SECRET"     // Replace with your Cloudinary API secret
});

// ================= MULTER CONFIG (VIDEO ONLY) =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(BACKEND_DIR, "temp")),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});

if (!fs.existsSync(path.join(BACKEND_DIR, "temp"))) {
  fs.mkdirSync(path.join(BACKEND_DIR, "temp"), { recursive: true });
}

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    const allowed = /mp4|webm/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = /video\//.test(file.mimetype);
    ext && mime ? cb(null, true) : cb(new Error("Only videos allowed"));
  }
});

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= ADMIN PANEL =================
app.get("/admin", (req, res) => {
  const adminPage = path.join(BACKEND_DIR, "admin.html");
  fs.existsSync(adminPage)
    ? res.sendFile(adminPage)
    : res.status(404).send("Admin page not found");
});

// ================= POSTS API =================
app.get("/api/posts", (req, res) => {
  if (!fs.existsSync(POSTS_FILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(POSTS_FILE, "utf-8")));
});

app.post("/api/posts", upload.single("media"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Video is required" });

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, { resource_type: "video" });

    // Delete temp file
    fs.unlinkSync(req.file.path);

    const posts = fs.existsSync(POSTS_FILE) ? JSON.parse(fs.readFileSync(POSTS_FILE, "utf-8")) : [];

    posts.unshift({
      id: Date.now(),
      title: req.body.title,
      content: req.body.content,
      type: req.body.type || "General",
      media: result.secure_url,
      mediaType: req.file.mimetype,
      date: new Date().toDateString()
    });

    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE POST + VIDEO
app.delete("/api/posts/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!fs.existsSync(POSTS_FILE)) return res.json({ success: false });

  let posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf-8"));
  const post = posts.find(p => p.id === id);

  if (post && post.media) {
    try {
      // Delete from Cloudinary
      const publicId = post.media.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
    } catch (err) {
      console.warn("Failed to delete video from Cloudinary:", err.message);
    }
  }

  posts = posts.filter(p => p.id !== id);
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));

  res.json({ success: true });
});

// ================= JOBS API =================
app.get("/api/jobs", (req, res) => {
  if (!fs.existsSync(JOBS_FILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(JOBS_FILE, "utf-8")));
});

app.post("/api/jobs", (req, res) => {
  const jobs = fs.existsSync(JOBS_FILE) ? JSON.parse(fs.readFileSync(JOBS_FILE, "utf-8")) : [];

  jobs.unshift({
    id: Date.now(),
    title: req.body.title,
    link: req.body.link,
    company: req.body.company,
    date: new Date().toDateString()
  });

  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
  res.json({ success: true });
});

app.delete("/api/jobs/:id", (req, res) => {
  if (!fs.existsSync(JOBS_FILE)) return res.json({ success: false });

  const jobs = JSON.parse(fs.readFileSync(JOBS_FILE, "utf-8")).filter(
    job => job.id !== Number(req.params.id)
  );

  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
  res.json({ success: true });
});

// ================= DEFAULT ROUTE =================
app.get("/", (req, res) => {
  res.json({ message: "Backend running" });
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔐 Admin panel: /admin`);
});