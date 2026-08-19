require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const requireAdminPage = require('./middleware/requireAdminPage');
const requireAdminApi = require('./middleware/requireAdminApi');
const { slugify, uniqueSlug } = require('./utils/slugify');

const app = express();
const PORT = process.env.PORT || 3000;

// These default to folders inside the project, but can be pointed at a
// mounted persistent disk (e.g. on Render) via env vars — so upgrading to
// real persistent storage later needs zero code changes.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
const SERVER_DATA_DIR = process.env.SERVER_DATA_DIR || path.join(__dirname, 'server-data');
const ADMIN_CREDENTIALS_PATH = path.join(SERVER_DATA_DIR, 'admin.json');
const PRODUCTS_PATH = path.join(DATA_DIR, 'products.json');
const SEED_DATA_DIR = path.join(__dirname, 'seed-data');

const VALID_CATEGORIES = ['Women', 'Men', 'Shoes', 'Bags'];

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(SERVER_DATA_DIR)) fs.mkdirSync(SERVER_DATA_DIR, { recursive: true });

// If DATA_DIR points at a fresh/empty persistent disk (e.g. first boot on a
// new Render disk), seed it with the site's starting content.
if (!fs.existsSync(PRODUCTS_PATH) && fs.existsSync(SEED_DATA_DIR)) {
  fs.readdirSync(SEED_DATA_DIR).forEach((file) => {
    const dest = path.join(DATA_DIR, file);
    if (!fs.existsSync(dest)) fs.copyFileSync(path.join(SEED_DATA_DIR, file), dest);
  });
}

if (!process.env.SESSION_SECRET) {
  console.error('Missing SESSION_SECRET in .env — refusing to start with an insecure default.');
  process.exit(1);
}

// Bootstrap the admin account from env vars if none exists yet — needed on
// hosts (like Render's free tier) with no shell access to run `npm run
// create-admin`. Safe to leave the env vars set: this only runs once, the
// first time admin.json doesn't exist yet.
if (!fs.existsSync(ADMIN_CREDENTIALS_PATH) && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
  if (process.env.ADMIN_PASSWORD.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters — skipping admin bootstrap.');
  } else {
    const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);
    fs.writeFileSync(ADMIN_CREDENTIALS_PATH, JSON.stringify({ username: process.env.ADMIN_USERNAME, passwordHash }, null, 2));
    console.log(`Admin account bootstrapped for "${process.env.ADMIN_USERNAME}" from environment variables.`);
  }
}

function readProducts() {
  return JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf-8'));
}
function writeProducts(list) {
  fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(list, null, 2));
}

// Backfill slugs for any product that doesn't have one yet (e.g. products
// created before slugs existed), so every product has a stable, clean URL.
function ensureProductSlugs() {
  const products = readProducts();
  const existingSlugs = new Set(products.filter((p) => p.slug).map((p) => p.slug));
  let changed = false;

  products.forEach((p) => {
    if (!p.slug) {
      const slug = uniqueSlug(slugify(p.name), existingSlugs);
      existingSlugs.add(slug);
      p.slug = slug;
      changed = true;
    }
  });

  if (changed) writeProducts(products);
}

ensureProductSlugs();

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://images.pexels.com'],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  name: 'bjay.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 4, // 4 hours
  },
}));

// ---------------------------------------------------------------------------
// Public storefront (static files served explicitly — never the whole root,
// so server.js, .env, node_modules, server-data etc. can never be fetched)
// ---------------------------------------------------------------------------
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/data', express.static(DATA_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

// Clean URLs (no .html) — old .html links 301-redirect to the clean path so
// nothing breaks for anyone with an old link bookmarked.
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/products', (req, res) => res.sendFile(path.join(__dirname, 'products.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));
app.get('/products/:slug', (req, res) => {
  const exists = readProducts().some((p) => p.slug === req.params.slug);
  if (!exists) return res.status(404).sendFile(path.join(__dirname, '404.html'));
  res.sendFile(path.join(__dirname, 'product.html'));
});

app.get('/index.html', (req, res) => res.redirect(301, '/'));
app.get('/about.html', (req, res) => res.redirect(301, '/about'));
app.get('/products.html', (req, res) => res.redirect(301, '/products'));
app.get('/contact.html', (req, res) => res.redirect(301, '/contact'));

// ---------------------------------------------------------------------------
// Admin auth helpers
// ---------------------------------------------------------------------------
function loadAdminCredentials() {
  if (!fs.existsSync(ADMIN_CREDENTIALS_PATH)) return null;
  return JSON.parse(fs.readFileSync(ADMIN_CREDENTIALS_PATH, 'utf-8'));
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// ---------------------------------------------------------------------------
// Admin pages
// ---------------------------------------------------------------------------
app.get('/admin/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});
app.get('/admin/login.css', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'login.css')));
app.get('/admin/login.js', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'login.js')));

app.get('/admin', requireAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
});
app.get('/admin/dashboard.css', requireAdminPage, (req, res) => res.sendFile(path.join(__dirname, 'admin', 'dashboard.css')));
app.get('/admin/dashboard.js', requireAdminPage, (req, res) => res.sendFile(path.join(__dirname, 'admin', 'dashboard.js')));

// ---------------------------------------------------------------------------
// Admin auth API
// ---------------------------------------------------------------------------
app.post('/admin/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  const creds = loadAdminCredentials();

  if (!creds) {
    return res.status(500).json({ error: 'No admin account has been set up yet.' });
  }
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid username or password.' });
  }

  const usernameMatches = username === creds.username;
  const passwordMatches = await bcrypt.compare(password, creds.passwordHash);

  if (!usernameMatches || !passwordMatches) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not start session.' });
    req.session.isAdmin = true;
    req.session.username = username;
    res.json({ success: true });
  });
});

app.post('/admin/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/admin/api/session', (req, res) => {
  res.json({
    loggedIn: !!(req.session && req.session.isAdmin),
    username: req.session && req.session.username ? req.session.username : null,
  });
});

// ---------------------------------------------------------------------------
// Admin API (everything below requires a valid session)
// ---------------------------------------------------------------------------
const adminApi = express.Router();
adminApi.use(requireAdminApi);

function validateProductInput(body, { partial } = { partial: false }) {
  const errors = [];
  const { name, category, description, price } = body || {};

  if (!partial || name !== undefined) {
    if (!name || !String(name).trim()) errors.push('Name is required.');
  }
  if (!partial || category !== undefined) {
    if (!VALID_CATEGORIES.includes(category)) errors.push(`Category must be one of: ${VALID_CATEGORIES.join(', ')}.`);
  }
  if (!partial || description !== undefined) {
    if (!description || !String(description).trim()) errors.push('Description is required.');
  }
  if (!partial || price !== undefined) {
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) errors.push('Price must be a positive number.');
  }

  return errors;
}

adminApi.get('/products', (req, res) => {
  res.json(readProducts());
});

adminApi.post('/products', (req, res) => {
  const errors = validateProductInput(req.body);
  const { image } = req.body || {};
  if (!image) errors.push('Product image is required.');
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const { name, category, description, price, featured } = req.body;
  const products = readProducts();
  const id = `p${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
  const existingSlugs = new Set(products.map((p) => p.slug).filter(Boolean));
  const slug = uniqueSlug(slugify(name), existingSlugs);

  const product = {
    id,
    slug,
    name: String(name).trim(),
    category,
    description: String(description).trim(),
    price: Number(price),
    image,
    featured: !!featured,
  };

  products.push(product);
  writeProducts(products);
  res.status(201).json(product);
});

adminApi.put('/products/:id', (req, res) => {
  const products = readProducts();
  const idx = products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found.' });

  const errors = validateProductInput(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const { name, category, description, price, image, featured } = req.body;
  products[idx] = {
    ...products[idx],
    name: name !== undefined ? String(name).trim() : products[idx].name,
    category: category !== undefined ? category : products[idx].category,
    description: description !== undefined ? String(description).trim() : products[idx].description,
    price: price !== undefined ? Number(price) : products[idx].price,
    image: image !== undefined && image ? image : products[idx].image,
    featured: featured !== undefined ? !!featured : products[idx].featured,
  };

  writeProducts(products);
  res.json(products[idx]);
});

adminApi.delete('/products/:id', (req, res) => {
  const products = readProducts();
  const idx = products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found.' });
  const [removed] = products.splice(idx, 1);
  writeProducts(products);
  res.json({ success: true, removed });
});

// ---- Image upload ----
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ALLOWED_EXT.includes(ext) ? ext : '.jpg'}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed.'));
    }
    cb(null, true);
  },
});

adminApi.post('/upload', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

// ---- Change password ----
adminApi.post('/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const creds = loadAdminCredentials();

  const match = await bcrypt.compare(currentPassword || '', creds.passwordHash);
  if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  fs.writeFileSync(ADMIN_CREDENTIALS_PATH, JSON.stringify({ username: creds.username, passwordHash: newHash }, null, 2));
  res.json({ success: true });
});

app.use('/admin/api', adminApi);

// ---------------------------------------------------------------------------
// 404 — catch-all for any route that didn't match above
// ---------------------------------------------------------------------------
app.use((req, res) => {
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(__dirname, '404.html'));
  }
  res.status(404).json({ error: 'Not found.' });
});

app.listen(PORT, () => {
  console.log(`B'JAY CLOSET server running at http://localhost:${PORT}`);
});
