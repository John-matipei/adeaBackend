const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;

const BACKEND_DIR = __dirname;
const UPLOAD_DIR = path.join(BACKEND_DIR, "uploads");
const POSTS_FILE = path.join(BACKEND_DIR, "posts.json");
const JOBS_FILE = path.join(BACKEND_DIR, "jobs.json");

// ================= ENSURE UPLOADS FOLDER =================
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ================= MULTER CONFIG (LARGE FILES) =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});

// Increase fileSize limit to 500MB for long videos
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = /image|video/.test(file.mimetype);
    ext && mime
      ? cb(null, true)
      : cb(new Error("Only images or videos allowed"));
  }
});

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOAD_DIR));

// ================= ADMIN PANEL =================
app.get("/admin", (req, res) => {
  const adminPage = path.join(BACKEND_DIR, "admin.html");
  if (fs.existsSync(adminPage)) {
    res.sendFile(adminPage);
  } else {
    res.status(404).send("Admin page not found");
  }
});

// ================= POSTS API =================
app.get("/api/posts", (req, res) => {
  if (!fs.existsSync(POSTS_FILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(POSTS_FILE)));
});

app.post("/api/posts", upload.single("media"), (req, res) => {
  const posts = fs.existsSync(POSTS_FILE)
    ? JSON.parse(fs.readFileSync(POSTS_FILE))
    : [];

  posts.unshift({
    id: Date.now(),
    title: req.body.title,
    content: req.body.content,
    type: req.body.type || "General",
    media: req.file ? `/uploads/${req.file.filename}` : "",
    date: new Date().toDateString()
  });

  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
  res.json({ success: true });
});

// ✅ PERMANENT DELETE POST + MEDIA FILE
app.delete("/api/posts/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (!fs.existsSync(POSTS_FILE)) return res.json({ success: false });

  let posts = JSON.parse(fs.readFileSync(POSTS_FILE));
  const postToDelete = posts.find(p => p.id === id);

  // delete media file if exists
  if (postToDelete && postToDelete.media) {
    const mediaPath = path.join(BACKEND_DIR, postToDelete.media);
    if (fs.existsSync(mediaPath)) {
      fs.unlinkSync(mediaPath);
    }
  }

  posts = posts.filter(p => p.id !== id);
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));

  res.json({ success: true });
});

// ================= JOBS API =================
app.get("/api/jobs", (req, res) => {
  if (!fs.existsSync(JOBS_FILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(JOBS_FILE)));
});

app.post("/api/jobs", (req, res) => {
  const jobs = fs.existsSync(JOBS_FILE)
    ? JSON.parse(fs.readFileSync(JOBS_FILE))
    : [];

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

// ✅ PERMANENT DELETE JOB
app.delete("/api/jobs/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (!fs.existsSync(JOBS_FILE)) return res.json({ success: false });

  const jobs = JSON.parse(fs.readFileSync(JOBS_FILE))
    .filter(job => job.id !== id);

  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
  res.json({ success: true });
});

// ================= DEFAULT ROUTE =================
app.get("/", (req, res) => {
  res.json({
    message: "Backend is running. Use /admin to manage posts and jobs."
  });
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`✅ Server running at port ${PORT}`);
  console.log(`🔐 Admin panel: /admin`);
});