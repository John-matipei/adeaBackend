// backend.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;

const BACKEND_DIR = __dirname;
const UPLOAD_DIR = path.join(BACKEND_DIR, "uploads"); // Permanent video storage
const POSTS_FILE = path.join(BACKEND_DIR, "posts.json");
const JOBS_FILE = path.join(BACKEND_DIR, "jobs.json");

// ================= ENSURE UPLOADS FOLDER =================
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ================= MULTER CONFIG (VIDEO ONLY) =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});

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
app.use("/uploads", express.static(UPLOAD_DIR)); // Serve videos

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
  let posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf-8"));

  // Remove any posts that have image links accidentally
  posts = posts.filter(p => p.media && (p.media.endsWith(".mp4") || p.media.endsWith(".webm")));
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));

  res.json(posts);
});

app.post("/api/posts", upload.single("media"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Video is required" });

    const posts = fs.existsSync(POSTS_FILE)
      ? JSON.parse(fs.readFileSync(POSTS_FILE, "utf-8"))
      : [];

    posts.unshift({
      id: Date.now(),
      title: req.body.title,
      content: req.body.content,
      type: req.body.type || "General",
      media: `/uploads/${req.file.filename}`, // Local video path
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
app.delete("/api/posts/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!fs.existsSync(POSTS_FILE)) return res.json({ success: false });

  let posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf-8"));
  const post = posts.find(p => p.id === id);

  if (post && post.media) {
    const videoPath = path.join(BACKEND_DIR, post.media);
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath); // Delete video locally
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
  res.json({ message: "Backend running (videos only, permanent local storage)" });
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔐 Admin panel: /admin`);
});