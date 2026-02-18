const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");

const app = express();
const PORT = 4000;

const BACKEND_DIR = __dirname;
const FRONTEND_DIR = path.join(__dirname, "..", "AdeaFront"); // Frontend folder
const UPLOAD_DIR = path.join(BACKEND_DIR, "uploads"); // Save uploads in backend/uploads

const POSTS_FILE = path.join(BACKEND_DIR, "posts.json");
const JOBS_FILE = path.join(BACKEND_DIR, "jobs.json");

// Ensure uploads folder exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ================= MULTER (IMAGES ONLY) =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = /image|video/.test(file.mimetype);

    ext && mime ? cb(null, true) : cb(new Error("Only images or videos allowed"));
  }
});


// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= STATIC FILES =================
app.use(express.static(FRONTEND_DIR));
app.use("/uploads", express.static(UPLOAD_DIR));

// ================= ADMIN PANEL =================
app.get("/admin", (req, res) => {
  res.sendFile(path.join(BACKEND_DIR, "admin.html"));
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

app.delete("/api/posts/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (!fs.existsSync(POSTS_FILE)) return res.json({ success: false });

  const posts = JSON.parse(fs.readFileSync(POSTS_FILE))
    .filter(p => p.id !== id);

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

app.delete("/api/jobs/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (!fs.existsSync(JOBS_FILE)) return res.json({ success: false });

  const jobs = JSON.parse(fs.readFileSync(JOBS_FILE))
    .filter(j => j.id !== id);

  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
  res.json({ success: true });
});

// ================= DEFAULT ROUTES =================
app.get("/", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "index.html")));
app.get("/:page", (req, res) => {
  const page = path.join(FRONTEND_DIR, req.params.page);
  fs.existsSync(page) ? res.sendFile(page) : res.status(404).send("Page not found");
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`🔐 Admin panel: http://localhost:${PORT}/admin`);
});
