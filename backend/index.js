// Import statements
require('dotenv').config();
const express = require('express');
const crypto = require('crypto');

// Admin configuration - these should be in environment variables
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'maYaNsh@adMin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || crypto.randomBytes(64).toString('hex');

// Admin authentication middleware
const adminAuth = (req, res, next) => {
  const adminToken = req.session.adminToken;
  if (!adminToken || adminToken !== ADMIN_TOKEN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

// Initialize Express app
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by'); // Remove Express identifier

// Configure MongoDB connection with optimized settings
mongoose.set('strictQuery', true);
mongoose.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

// Optimize MongoDB connection options
const mongoOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false
};

const server = http.createServer(app);
const io = socketIo(server, {
  pingTimeout: 20000,
  pingInterval: 5000,
  cors: {
    origin: process.env.NODE_ENV === 'production' ? 
      [process.env.FRONTEND_URL, process.env.BASE_URL, process.env.RENDER_EXTERNAL_URL, process.env.VERCEL_URL].filter(Boolean) : 
      "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  connectTimeout: 8000,
  maxHttpBufferSize: 5e6, // 5 MB
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  path: '/socket.io',
  cookie: false,
  serveClient: true, // Enable serving client files
  upgradeTimeout: 8000,
  allowUpgrades: true,
  perMessageDeflate: {
    threshold: 1024,
    concurrencyLimit: 20
  }
});

// Web Push setup
const webpush = require('web-push');

// Email configuration (you can use services like SendGrid, Nodemailer with Gmail, etc.)
const nodemailer = require('nodemailer');

// Configure email transporter
let emailTransporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
} else {
  console.log('Email configuration not provided. Password reset functionality will be disabled.');
}

// Password reset schema
const passwordResetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 } // Expires in 1 hour
});

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

// Pending notifications schema for offline users (excluding warnings)
const pendingNotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true, validate: { validator: v => v !== 'warning', message: 'Warnings use separate system' } },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Expires in 24 hours
});

pendingNotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
pendingNotificationSchema.index({ userId: 1, createdAt: -1 });

const PendingNotification = mongoose.model('PendingNotification', pendingNotificationSchema);

// Warning notification system helper class
class WarningNotificationSystem {
  static async sendWarningToUser(userId, message, adminId = 'admin') {
    try {
      const warningId = new mongoose.Types.ObjectId();
      const warning = {
        _id: warningId,
        message: message.trim(),
        timestamp: new Date(),
        adminId: adminId,
        acknowledged: false,
        delivered: false
      };

      // Single atomic operation to add warning
      const updateResult = await User.findByIdAndUpdate(userId, {
        $push: { warnings: warning }
      }, { new: true }).select('username warnings').lean();

      if (!updateResult) {
        throw new Error('User not found');
      }

      // Check if user is online and deliver immediately
      const room = io.sockets.adapter.rooms.get(userId.toString());
      const isUserOnline = room && room.size > 0;

      if (isUserOnline) {
        // Send via socket
        io.to(userId.toString()).emit('warning', {
          id: warningId.toString(),
          message: warning.message,
          timestamp: warning.timestamp,
          type: 'warning'
        });

        // Mark as delivered immediately
        await User.findByIdAndUpdate(userId, {
          $set: {
            'warnings.$[elem].delivered': true,
            'warnings.$[elem].deliveredAt': new Date()
          }
        }, {
          arrayFilters: [{ 'elem._id': warningId }]
        });

        if (process.env.NODE_ENV !== 'production') {
          console.log(`Warning delivered immediately via socket to user ${userId} (${updateResult.username || 'Unknown'})`);
        }
        return { success: true, delivered: true, warningId: warningId.toString() };
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`User ${userId} (${updateResult.username || 'Unknown'}) offline - warning will be delivered on next login`);
        }
        return { success: true, delivered: false, warningId: warningId.toString() };
      }
    } catch (error) {
      console.error('Error sending warning:', error);
      throw error;
    }
  }

  static async acknowledgeWarning(userId, warningId) {
    try {
      // Validate inputs
      if (!mongoose.Types.ObjectId.isValid(warningId)) {
        throw new Error('Invalid warning ID format');
      }

      // Single atomic operation with proper error handling
      const updateResult = await User.findOneAndUpdate(
        { 
          _id: userId,
          'warnings._id': warningId,
          'warnings.acknowledged': { $ne: true }
        },
        {
          $set: {
            'warnings.$.acknowledged': true,
            'warnings.$.acknowledgedAt': new Date()
          }
        },
        { new: true }
      ).select('username').lean();

      if (!updateResult) {
        throw new Error('Warning not found or already acknowledged');
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`Warning ${warningId} acknowledged by user ${userId} (${updateResult.username || 'Unknown'})`);
      }
      return { success: true, warningId: warningId };
    } catch (error) {
      console.error('Error acknowledging warning:', error);
      throw error;
    }
  }

  static async getUndeliveredWarnings(userId) {
    try {
      const user = await User.findById(userId).select('warnings').lean();
      if (!user || !user.warnings) {
        return [];
      }

      // Filter for undelivered and unacknowledged warnings from last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return user.warnings.filter(warning => 
        !warning.acknowledged && 
        !warning.delivered &&
        warning.timestamp > sevenDaysAgo
      );
    } catch (error) {
      console.error('Error getting undelivered warnings:', error);
      return [];
    }
  }

  static async markWarningsAsDelivered(userId, warningIds) {
    try {
      if (!warningIds || warningIds.length === 0) return;

      await User.findByIdAndUpdate(userId, {
        $set: {
          'warnings.$[elem].delivered': true,
          'warnings.$[elem].deliveredAt': new Date()
        }
      }, {
        arrayFilters: [{ 
          'elem._id': { $in: warningIds.map(id => new mongoose.Types.ObjectId(id)) },
          'elem.delivered': { $ne: true }
        }]
      });
    } catch (error) {
      console.error('Error marking warnings as delivered:', error);
    }
  }
}

// Generate VAPID keys if not present
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  const newVapidKeys = webpush.generateVAPIDKeys();
  vapidKeys.publicKey = newVapidKeys.publicKey;
  vapidKeys.privateKey = newVapidKeys.privateKey;
  console.log('Generated new VAPID keys. Please save these in your environment variables:');
  console.log('VAPID_PUBLIC_KEY:', vapidKeys.publicKey);
  console.log('VAPID_PRIVATE_KEY:', vapidKeys.privateKey);
}

try {
  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_EMAIL || 'mayanshbangali49@gmail.com'),
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
  if (process.env.NODE_ENV !== 'production') {
    console.log('VAPID configuration successful');
  }
} catch (error) {
  console.error('Error setting VAPID details:', error.message);
  process.exit(1);
}

// Validate VAPID key format
if (vapidKeys.publicKey.includes(' ') || vapidKeys.privateKey.includes(' ')) {
  console.error('VAPID keys contain spaces. Please check the format.');
  process.exit(1);
}

webpush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'mayanshbangali49@gmail.com'),
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Database connection function
async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
    if (process.env.NODE_ENV !== 'production') {
      console.log('Connected to MongoDB');
    }
    return true;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    return false;
  }
}

// Define schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, index: { unique: true } },
  email: { type: String, required: true, index: { unique: true } },
  password: { type: String, required: true, select: false },
  ip: { type: String },
  ipHistory: [{
    ip: String,
    timestamp: { type: Date, default: Date.now }
  }],
  fullName: String,
  bio: String,
  socialProfiles: {
    instagram: String,
    facebook: String,
    twitter: String,
    linkedin: String,
    snapchat: String,
    spotify: String
  },
  interests: {
    hobbies: [String],
    topSongs: [String],
    aboutMe: String
  },
  lastLocation: {
    latitude: Number,
    longitude: Number,
    lastUpdated: { type: Date, index: -1 }
  },
  profilePicture: String,
  pushSubscription: Object,
  anonymousMode: { type: Boolean, default: false },
  banned: { type: Boolean, default: false, index: true },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date },
  verifiedBy: { type: String },
  warnings: [{ 
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    adminId: { type: String, required: true },
    acknowledged: { type: Boolean, default: false },
    acknowledgedAt: { type: Date },
    delivered: { type: Boolean, default: false },
    deliveredAt: { type: Date }
  }],
  deleted: { type: Boolean, default: false }
}, { timestamps: true });

const requestSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending', index: true },
  createdAt: { type: Date, default: Date.now, index: -1 }
});

const messageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  content: String,
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false, index: true }
});

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  content: String,
  image: String,
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now, index: -1 }
});

// Create comprehensive indexes for optimal performance
userSchema.index({ 'lastLocation.latitude': 1, 'lastLocation.longitude': 1, 'lastLocation.lastUpdated': -1 });
userSchema.index({ banned: 1, deleted: 1, 'lastLocation.lastUpdated': -1 });
userSchema.index({ username: 'text', fullName: 'text' }); // Text search
userSchema.index({ verified: 1 });
userSchema.index({ anonymousMode: 1 });
userSchema.index({ timestamp: -1 }); // For cleanup operations
userSchema.index({ 'warnings.acknowledged': 1, 'warnings.delivered': 1 }); // For warning queries
userSchema.index({ 'warnings._id': 1 }); // For individual warning lookups
userSchema.index({ 'warnings.timestamp': -1, 'warnings.acknowledged': 1 }); // For recent warnings

requestSchema.index({ from: 1, to: 1 }, { unique: true });
requestSchema.index({ to: 1, status: 1, createdAt: -1 });
requestSchema.index({ from: 1, status: 1, createdAt: -1 });

messageSchema.index({ from: 1, to: 1, timestamp: -1 });
messageSchema.index({ to: 1, read: 1, timestamp: -1 });

postSchema.index({ user: 1, createdAt: -1, deleted: 1 });
postSchema.index({ createdAt: -1, deleted: 1 }); // For feed queries
postSchema.index({ 'likes': 1 }); // For like queries

// Create models
const User = mongoose.model('User', userSchema);
const Request = mongoose.model('Request', requestSchema);
const Message = mongoose.model('Message', messageSchema);
const Post = mongoose.model('Post', postSchema);

// Middleware
// Configure body parser with consistent limits
const bodyParserOptions = {
  limit: '100mb',
  parameterLimit: 100000,
  extended: true
};

app.use(express.json(bodyParserOptions));
app.use(express.urlencoded(bodyParserOptions));
app.use(express.raw(bodyParserOptions));
app.use(express.text(bodyParserOptions));

// Serve static files from frontend folder
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Serve Socket.IO client library
app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));
});

// PWA and SEO routes
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'manifest.json'));
});

app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'sitemap.xml'));
});

app.get('/browserconfig.xml', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'browserconfig.xml'));
});

// Add request compression middleware with optimized settings
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Add cache control middleware for static assets
app.use('/icons', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
  res.setHeader('Vary', 'Accept-Encoding');
  next();
});

app.use('/stylesheets', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
  res.setHeader('Vary', 'Accept-Encoding');
  next();
});

app.use('/javascripts', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
  res.setHeader('Vary', 'Accept-Encoding');
  next();
});

// Add caching and performance headers
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute default cache

app.use('/api', (req, res, next) => {
  res.setHeader('Vary', 'Accept-Encoding');

  // Add performance headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next();
});

// Cache middleware for read-only endpoints
const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = `${req.originalUrl || req.url}_${req.session.userId}`;
    const cached = cache.get(key);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    res.setHeader('X-Cache', 'MISS');
    const originalJson = res.json;
    res.json = function(data) {
      cache.set(key, data, duration);
      return originalJson.call(this, data);
    };

    next();
  };
};

// Override raw-body settings for larger payloads
app.use((req, res, next) => {
  req.maxPayload = '100mb';
  next();
});

// Comprehensive rate limiting strategy
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // More restrictive for auth
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts from this IP, please try again after some time',
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests, please try again later',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Allow 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}_${req.session?.userId || 'anonymous'}`,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded, please slow down',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Strict limiter for expensive operations
const strictLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requests per 5 minutes
  keyGenerator: (req) => `${req.ip}_${req.session?.userId || 'anonymous'}`,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests for this operation',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Apply rate limiting
app.use('/api', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/nearby', strictLimiter);
app.use('/api/posts', strictLimiter);


// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600,
    crypto: false, // Disable encryption to fix parsing error
    autoRemove: 'interval',
    autoRemoveInterval: 24 * 60 // Remove expired sessions every 24 hours
  }),
  cookie: { 
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    sameSite: 'lax', // Changed to lax for better compatibility
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  name: 'sessionId',
  rolling: true
}));

// Add cookie parser middleware (required for CSRF)
app.use(cookieParser());

// Add CSRF protection middleware
const csrf = require('csurf');
const csrfProtection = csrf({ 
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  }
});

// Apply CSRF protection selectively
app.use((req, res, next) => {
  if (req.path === '/api/csrf-token' || req.method === 'GET' || process.env.NODE_ENV !== 'production') {
    next();
  } else {
    csrfProtection(req, res, next);
  }
});

// Expose CSRF token to frontend
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Content security policy
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "wss:", "https:"],
      workerSrc: ["'self'", "blob:"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"]
    },
    reportOnly: false
  })
);


// Authentication middleware
const isAuthenticated = async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is banned
  try {
    const user = await User.findById(req.session.userId).select('banned').lean();

    if (!user) {
      req.session.destroy();
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.banned) {
      req.session.destroy();
      return res.status(403).json({ error: 'Your account has been banned. Please contact an administrator.' });
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    next();
  }
};

// Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, fullName, email } = req.body;

    // Input validation
    if (!username || !password || !fullName || !email) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Email validation
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Escape special characters in email for regex
    const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Check if email already exists (case-insensitive)
    const existingEmail = await User.findOne({ 
      email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') }
    });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const ip = req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           req.ip ||
           'unknown';

    const user = new User({
      username,
      password: hashedPassword,
      fullName,
      email,
      ip: ip.split(',')[0].trim(), // Get first IP if forwarded
      socialProfiles: {},
      lastLocation: {},
      createdAt: new Date()
    });

    await user.save();
    req.session.userId = user._id;
    res.status(201).json({ message: 'User registered successfully', userId: user._id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Input validation
    if (!username || !password || 
        typeof username !== 'string' || 
        typeof password !== 'string') {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length > 30 || password.length > 100) {
      return res.status(400).json({ error: 'Invalid credentials format' });
    }

    // Generic error message to prevent username enumeration
    const genericErrorMessage = 'Invalid username or password';

    // Consistent timing approach - start timing
    const startTime = process.hrtime();

    // Find user with lean() for faster lookup (doesn't create full model instance)
    const user = await User.findOne({ username }).select('+password').lean();

    // Don't try to verify password if user doesn't exist, but maintain consistent timing
    let isPasswordValid = false;

    if (user) {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } else {
      // If no user found, do a dummy compare to maintain consistent timing
      await bcrypt.compare(password, '$2b$10$' + 'X'.repeat(53));
    }

    // If either user doesn't exist or password is invalid
    if (!user || !isPasswordValid) {
      // Calculate how long the operation took so far
      const elapsedTime = process.hrtime(startTime);
      const elapsedMs = elapsedTime[0] * 1000 + elapsedTime[1] / 1000000;

      // Add delay to ensure minimum response time of 500ms to prevent timing attacks
      if (elapsedMs < 500) {
        await new Promise(resolve => setTimeout(resolve, 500 - elapsedMs));
      }

      return res.status(401).json({ error: genericErrorMessage });
    }

    // Check if user is banned
    if (user.banned) {
      // Use same timing approach for security
      const elapsedTime = process.hrtime(startTime);
      const elapsedMs = elapsedTime[0] * 1000 + elapsedTime[1] / 1000000;
      if (elapsedMs < 500) {
        await new Promise(resolve => setTimeout(resolve, 500 - elapsedMs));
      }

      return res.status(403).json({ error: 'Your account has been banned. Please contact an administrator.' });
    }

    // Regenerate session for security (prevents session fixation)
    await new Promise((resolve, reject) => {
      req.session.regenerate(async function(err) {
        try {
          if (err) {
            reject(err);
            return;
          }

          // Store user data in session including IP
          // Enhanced IP address extraction
          let ip = req.headers['x-forwarded-for'] || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress || 
                   req.ip ||
                   'unknown';

          // Clean up IP address
          if (ip !== 'unknown') {
            // Take first IP if forwarded
            ip = ip.split(',')[0].trim();
            // Remove IPv6 prefix if present
            ip = ip.replace(/^::ffff:/, '');
          }

          req.session.userId = user._id;
          req.session.username = user.username;
          req.session.lastActive = Date.now();
          req.session.ip = ip;

          // Update user's IP in database with validation
          if (ip !== 'unknown') {
            await User.findByIdAndUpdate(user._id, { 
              ip: ip,
              $push: { 
                ipHistory: {
                  ip: ip,
                  timestamp: new Date()
                }
              }
            });
          }

          // Set a session token for additional validation
          const sessionToken = require('crypto').randomBytes(32).toString('hex');
          req.session.token = sessionToken;

          // Return success with minimal data
          res.status(200).json({ 
            message: 'Login successful', 
            userId: user._id 
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }).catch(error => {
      console.error('Session regeneration error:', error);
      res.status(500).json({ error: 'Login failed. Please try again.' });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.status(200).json({ message: 'Logout successful' });
});

// Password reset request endpoint
app.post('/api/reset-password-request', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const user = await User.findOne({ 
      email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });

    if (!user) {
      // Don't reveal if email exists or not for security
      return res.status(200).json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Save reset token to database
    await PasswordReset.findOneAndUpdate(
      { userId: user._id },
      { token: resetToken, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // Create reset URL - use dynamic host detection
    const host = req.get('host');
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';

    // Use environment variable if set, otherwise detect from request
    const baseUrl = process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `${protocol}://${host}`;
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&userId=${user._id}`;

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@zync.app',
      to: user.email,
      subject: 'Password Reset - Zync',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6c5ce7;">Zync Password Reset</h2>
          <p>Hello ${user.fullName || user.username},</p>
          <p>You requested a password reset for your Zync account. Click the link below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #6c5ce7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
          </div>
          <p>This link will expire in 1 hour for security purposes.</p>
          <p>If you didn't request this reset, please ignore this email.</p>
          <p>Best regards,<br>The Zync Team</p>
        </div>
      `
    };

    // Send email
    if (emailTransporter) {
        await emailTransporter.sendMail(mailOptions);
    } else {
        console.log('Email transporter is not configured. Password reset email cannot be sent.');
        return res.status(500).json({ error: 'Email service is not available.' });
    }

    res.status(200).json({ 
      message: 'If an account with that email exists, a password reset link has been sent.' 
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

// Password reset confirmation endpoint
app.post('/api/reset-password-confirm', async (req, res) => {
  try {
    const { token, userId, newPassword } = req.body;

    if (!token || !userId || !newPassword) {
      return res.status(400).json({ error: 'Token, user ID, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Find valid reset token
    const resetRecord = await PasswordReset.findOne({
      userId: userId,
      token: token
    });

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await User.findByIdAndUpdate(userId, { password: hashedPassword });

    // Delete the reset token
    await PasswordReset.findByIdAndDelete(resetRecord._id);

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Password reset confirm error:', error);
    res.status(500).json({ error: 'An error occurred while resetting your password' });
  }
});

app.put('/api/profile', isAuthenticated, async (req, res) => {
  try {
    const { fullName, bio, socialProfiles, profilePicture, interests } = req.body;

    // Check if profile picture is provided and valid
    const updateData = {
      fullName,
      bio,
      socialProfiles
    };

    // Add interests data if provided
    if (interests) {
      // Validate interests data
      if (interests.hobbies && !Array.isArray(interests.hobbies)) {
        return res.status(400).json({ error: 'Hobbies must be an array' });
      }

      if (interests.topSongs && !Array.isArray(interests.topSongs)) {
        return res.status(400).json({ error: 'Top songs must be an array' });
      }

      // Limit the number of items
      if (interests.hobbies) {
        interests.hobbies = interests.hobbies.slice(0, 10); // Max 10 hobbies
      }

      if (interests.topSongs) {
        interests.topSongs = interests.topSongs.slice(0, 3); // Max 3 songs
      }

      // Limit the length of aboutMe
      if (interests.aboutMe && interests.aboutMe.length > 500) {
        interests.aboutMe = interests.aboutMe.substring(0, 500);
      }

      updateData.interests = interests;
    }

    // Only update profile picture if it's provided and valid
    if (profilePicture !== undefined) {
      // Validate that it's a data URL (for images)
      if (typeof profilePicture === 'string' && 
          (profilePicture === '' || profilePicture.startsWith('data:image/'))) {
        updateData.profilePicture = profilePicture;
      } else if (profilePicture) {
        return res.status(400).json({ error: 'Invalid profile picture format' });
      }
    }

    // Update user and return the updated user data
    const updatedUser = await User.findByIdAndUpdate(
      req.session.userId, 
      updateData,
      { new: true } // Return the updated document
    ).select('-password');

    res.status(200).json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/location', isAuthenticated, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    // Validate location data - ensure we don't store NaN values
    const lat = Number(parseFloat(latitude));
    const lng = Number(parseFloat(longitude));

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Invalid location coordinates' });
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Location coordinates out of range' });
    }

    // Only update if we have valid numbers
    await User.findByIdAndUpdate(req.session.userId, {
      lastLocation: {
        latitude: lat,
        longitude: lng,
        lastUpdated: new Date()
      }
    });

    res.status(200).json({ message: 'Location updated successfully' });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get nearby users
app.get('/api/nearby', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await User.findById(userId);

    if (!user || !user.lastLocation) {
      return res.status(400).json({ error: 'User location not available' });
    }

    // Set cache headers to prevent stale data during anonymous mode changes
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Find nearby users (excluding current user)
    const nearbyUsers = await User.find({
      _id: { $ne: userId },
      lastLocation: { $exists: true },
      $expr: {
        $lte: [
          {
            $multiply: [
              6371000, // Earth radius in meters
              {
                $acos: {
                  $add: [
                    {
                      $multiply: [
                        { $sin: { $multiply: [{ $divide: [{ $arrayElemAt: ['$lastLocation.latitude', 0] }, 180] }, Math.PI] } },
                        { $sin: { $multiply: [{ $divide: [user.lastLocation.latitude, 180] }, Math.PI] } }
                      ]
                    },
                    {
                      $multiply: [
                        { $cos: { $multiply: [{ $divide: [{ $arrayElemAt: ['$lastLocation.latitude', 0] }, 180] }, Math.PI] } },
                        { $cos: { $multiply: [{ $divide: [user.lastLocation.latitude, 180] }, Math.PI] } },
                        { $cos: {
                          $subtract: [
                            { $multiply: [{ $divide: [{ $arrayElemAt: ['$lastLocation.longitude', 0] }, 180] }, Math.PI] },
                            { $multiply: [{ $divide: [user.lastLocation.longitude, 180] }, Math.PI] }
                          ]
                        }}
                      ]
                    }
                  ]
                }
              }
            ]
          },
          5000 // 5km radius
        ]
      }
    }).select('username fullName profilePicture anonymousMode verified lastLocation');

    // Map users with calculated distances and anonymized data
    const nearbyUsersWithDistance = nearbyUsers.map(nearbyUser => {
        const userObj = nearbyUser.toObject();

        // Haversine formula to calculate distance
        const R = 6371e3; // Radius of the earth in meters
        const φ1 = user.lastLocation.latitude * Math.PI / 180; // φ, λ in radians
        const φ2 = userObj.lastLocation.latitude * Math.PI / 180;
        const Δφ = (userObj.lastLocation.latitude - user.lastLocation.latitude) * Math.PI / 180;
        const Δλ = (userObj.lastLocation.longitude - user.lastLocation.longitude) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const distance = R * c;

        userObj.distance = distance;
        userObj.lastLocation = {
            latitude: userObj.lastLocation.latitude,
            longitude: userObj.lastLocation.longitude
        };

        // If user is in anonymous mode, anonymize their data
        if (userObj.anonymousMode) {
            return {
                _id: userObj._id,
                username: 'Anonymous User',
                fullName: 'Anonymous User',
                profilePicture: null,
                distance: userObj.distance,
                lastLocation: userObj.lastLocation,
                isAnonymous: true,
                verified: false // Don't show verified status for anonymous users
            };
        }

        return userObj;
    });

    // Sort by distance
    nearbyUsersWithDistance.sort((a, b) => a.distance - b.distance);

    res.status(200).json(nearbyUsersWithDistance);
} catch (error) {
    console.error('Get nearby users error:', error);
    res.status(500).json({ error: 'Failed to get nearby users' });
}
});

app.post('/api/request', isAuthenticated, async (req, res) => {
  try {
    const { toUserId } = req.body;

    if (!toUserId) {
      return res.status(400).json({ error: 'Missing toUserId parameter' });
    }

    // Check if a request already exists between these users - use lean() for faster query
    const existingRequest = await Request.findOne({
      $or: [
        { from: req.session.userId, to: toUserId },
        { from: toUserId, to: req.session.userId }
      ]
    }).lean();

    if (existingRequest) {
      return res.status(400).json({ 
        error: 'A connection request already exists between these users',
        status: existingRequest.status
      });
    }

    // Create the new connection request
    const request = new Request({
      from: req.session.userId,
      to: toUserId,
      status: 'pending'
    });

    await request.save();

    // Start notification processes in parallel using Promise.all for better performance
    Promise.all([
      // Socket notification - optimized room checking
      new Promise(resolve => {
        try {
          // Get room info with error handling
          const room = io.sockets.adapter.rooms.get(toUserId.toString());
          const isUserOnline = room && room.size > 0;

          // Emit socket event if the user is online
          if (isUserOnline) {
            io.to(toUserId.toString()).emit('new-request', {
              requestId: request._id,
              fromUserId: req.session.userId
            });
          }

          resolve(isUserOnline);
        } catch (err) {
          console.error('Socket room check error:', err);
          resolve(false);
        }
      }),

      // Push notification (if user is online or offline)
      new Promise(async resolve => {
        try {
          // Get sender info for notification
          const fromUser = await User.findById(req.session.userId)
            .select('username fullName profilePicture anonymousMode')
            .lean();

          if (fromUser) {
            // Use anonymous name if user is in anonymous mode
            const senderName = fromUser.anonymousMode ? 
              'Anonymous User' : (fromUser.fullName || fromUser.username);

            sendPushNotification(
              toUserId, 
              'New Connection Request', 
              `${senderName} wants to connect with you!`,
              '/',
              fromUser.anonymousMode
            );
          }
          resolve(true);
        } catch (err) {
          console.error('Error sending push notification:', err);
          resolve(false);
        }
      })
    ])
    .then(([isSocketDelivered]) => {
      // The user has already received a response at this point,
      // this is just for logging
      //console.log(`Request notification status: ${isSocketDelivered ? 'delivered via socket' : 'will be delivered when user logs in'}`);
    })
    .catch(err => {
      console.error('Error in notification process:', err);
    });

    // Return success response immediately without waiting for notifications
    return res.status(201).json({ 
      message: 'Connection request sent successfully',
      requestId: request._id
    });
  } catch (error) {
    console.error('Request error:', error);
    return res.status(400).json({ error: error.message });
  }
});

app.put('/api/request/:requestId', isAuthenticated, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Use findOneAndUpdate for better performance (single operation)
    const result = await Request.findOneAndUpdate(
      { 
        _id: requestId,
        to: req.session.userId // Security check: only the recipient can update
      },
      { $set: { status } },
      { new: true } // Return updated document
    );

    if (!result) {
      return res.status(404).json({ error: 'Request not found or you are not authorized to update it' });
    }

    // Send notification in background without blocking response
    setTimeout(() => {
      try {
        // Notify the sender about request status update
        io.to(result.from.toString()).emit('request-update', {
          requestId,
          toUserId: req.session.userId,
          status
        });

        // Send push notification for accepted requests
        if (status === 'accepted') {
          User.findById(req.session.userId)
            .select('username fullName anonymousMode')
            .lean()
            .then(currentUser => {
              if (currentUser) {
                const userName = currentUser.anonymousMode ? 
                  'Anonymous User' : (currentUser.fullName || currentUser.username);

                sendPushNotification(
                  result.from.toString(),
                  'Connection Request Accepted',
                  `${userName} accepted your connection request!`,
                  '/',
                  currentUser.anonymousMode
                );
              }
            })
            .catch(err => console.error('Error sending acceptance notification:', err));
        }
      } catch (err) {
        console.error('Error sending request update notification:', err);
      }
    }, 0);

    return res.status(200).json({ 
      message: `Request ${status === 'accepted' ? 'accepted' : 'declined'} successfully` 
    });
  } catch (error) {
    console.error('Request update error:', error);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

app.post('/api/message', isAuthenticated, async (req, res) => {
  try {
    const { toUserId, content } = req.body;

    // Check if there's an accepted request between users
    const request = await Request.findOne({
      $or: [
        { from: req.session.userId, to: toUserId },
        { from: toUserId, to: req.session.userId }
      ],
      status: 'accepted'
    });

    if (!request) {
      return res.status(403).json({ error: 'No accepted connection between users' });
    }

    const message = new Message({
      from: req.session.userId,
      to: toUserId,
      content
    });

    await message.save();

    // Get sender's info for notification
    const sender = await User.findById(req.session.userId);
    // Use "Anonymous User" as the sender name if user is in anonymous mode
    const senderName = sender.anonymousMode ? 'Anonymous User' : (sender.fullName || sender.username);

    // Send real-time message via Socket.IO
    io.to(toUserId.toString()).emit('new-message', {
      messageId: message._id,
      fromUserId: req.session.userId,
      content,
      isAnonymous: sender.anonymousMode // Add flag to indicate anonymous message
    });

    // Send push notification
    sendPushNotification(
      toUserId, 
      `New message from ${senderName}`, 
      content,
      '/',
      sender.anonymousMode // Pass anonymousMode flag
    );

    res.status(201).json({ message: 'Message sent successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/messages/:userId', isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get the messages
    const messages = await Message.find({
      $or: [
        { from: req.session.userId, to: userId },
        { from: userId, to: req.session.userId }
      ]
    }).sort('timestamp');

    res.status(200).json(messages);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Utility function for input validation andsanitization
const validateInput = (input, type) => {
  if (input === undefined || input === null) return null;

  switch (type) {
    case 'text':
      // Sanitize text input (trim and remove any potentially harmful characters)
      return typeof input === 'string' ? 
        input.trim().replace(/<\/?[^>]+(>|$)/g, "") : null;

    case 'dataUrl':
      // Validate data URL
      if (typeof input === 'string' && input.startsWith('data:')) {
        // Accept any image type
        if (!input.startsWith('data:image/')) {
          return null;
        }
        // Increased size limit to 50MB for images
        if (input.length > 50 * 1024 * 1024) return null;
        return input;
      }
      return null;

    case 'objectId':
      // Validate MongoDB Object ID format
      return typeof input === 'string' && /^[0-9a-fA-F]{24}$/.test(input) ? input : null;

    case 'coordinates':
      // Validate geographic coordinates
      if (typeof input !== 'object' || input === null) return null;
      const lat = parseFloat(input.latitude);
      const lng = parseFloat(input.longitude);
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return null;
      }
      return { latitude: lat, longitude: lng };

    default:
      return null;
  }
};

app.post('/api/post', isAuthenticated, async (req, res) => {
  try {
    const { content, image } = req.body;

    // Validate and sanitize inputs
    const sanitizedContent = content ? validateInput(content, 'text') : null;
    const validatedImage = image ? validateInput(image, 'dataUrl') : null;

    // Validate inputs
    if (!sanitizedContent && !validatedImage) {
      return res.status(400).json({ error: 'Post must include either text content or an image' });
    }

    // Create post object with required user ID
    const postData = {
      user: req.session.userId
    };

    // Add content if provided and valid
    if (sanitizedContent !== null) {
      postData.content = sanitizedContent;
    }

    // Add image if provided and valid
    if (validatedImage !== null) {
      postData.image = validatedImage;
    } else if (image) {
      return res.status(400).json({ error: 'Invalid image format. Please upload a valid image.' });
    }

    // Final check - make sure we have at least some content
    if ((!postData.content || postData.content === '') && !postData.image) {
      return res.status(400).json({ error: 'Post must include either text content or an image' });
    }

    const post = new Post(postData);
    await post.save();

    res.status(201).json({ message: 'Post created successfully', postId: post._id });
  } catch (error) {
    console.error('Post creation error:', error);
    res.status(500).json({ error: error.message || 'An error occurred while creating the post. Please try again.' });
  }
});

app.get('/api/posts', isAuthenticated, cacheMiddleware(120), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 25); // Reduce default limit
    const skip = (page - 1) * limit;

    // Use aggregation for better performance
    const posts = await Post.aggregate([
      {
        $match: { 
          deleted: { $ne: true },
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Only last 30 days
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                username: 1,
                fullName: 1,
                profilePicture: 1,
                verified: 1,
                anonymousMode: 1
              }
            }
          ]
        }
      },
      {
        $unwind: '$user'
      },
      {
        $addFields: {
          comments: {
            $map: {
              input: '$comments',
              as: 'comment',
              in: {
                _id: '$$comment._id',
                text: '$$comment.text',
                timestamp: '$$comment.timestamp',
                user: '$$comment.user'
              }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'comments.user',
          foreignField: '_id',
          as: 'commentUsers'
        }
      },
      {
        $addFields: {
          comments: {
            $map: {
              input: '$comments',
              as: 'comment',
              in: {
                _id: '$$comment._id',
                text: '$$comment.text',
                timestamp: '$$comment.timestamp',
                user: {
                  $let: {
                    vars: {
                      matchedUser: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: '$commentUsers',
                              cond: { $eq: ['$$this._id', '$$comment.user'] }
                            }
                          },
                          0
                        ]
                      }
                    },
                    in: {
                      _id: '$$matchedUser._id',
                      username: '$$matchedUser.username',
                      fullName: '$$matchedUser.fullName',
                      profilePicture: '$$matchedUser.profilePicture',
                      verified: '$$matchedUser.verified',
                      anonymousMode: '$$matchedUser.anonymousMode'
                    }
                  }
                }
              }
            }
          },
          likesCount: { $size: { $ifNull: ['$likes', []] } },
          commentsCount: { $size: { $ifNull: ['$comments', []] } }
        }
      },
      {
        $project: {
          commentUsers: 0 // Remove the temporary commentUsers field
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      }
    ]);

    // Anonymize data for anonymous users
    const processedPosts = posts.map(post => {
      if (post.user?.anonymousMode) {
        post.user = {
          _id: post.user._id,
          username: 'Anonymous User',
          fullName: 'Anonymous User',
          profilePicture: null,
          verified: false
        };
      }

      post.comments = post.comments.map(comment => {
        if (comment.user?.anonymousMode) {
          comment.user = {
            _id: comment.user._id,
            username: 'Anonymous User',
            fullName: 'Anonymous User',
            verified: false
          };
        }
        return comment;
      });

      return post;
    });

    res.set('Cache-Control', 'public, max-age=30'); // Cache for 30 seconds
    res.status(200).json(processedPosts);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Toggle anonymous mode
app.post('/api/toggle-anonymous', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await User.findByIdAndUpdate(
      userId,
      [{ $set: { anonymousMode: { $not: "$anonymousMode" } } }],
      { new: true }
    ).select('anonymousMode username').lean(); // Use lean for faster response

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Immediately send response to frontend for faster UI update
    res.status(200).json({ 
      anonymousMode: user.anonymousMode,
      message: user.anonymousMode ? 'Anonymous mode activated' : 'Anonymous mode deactivated'
    });

    // Handle socket notifications asynchronously after response is sent
    setImmediate(() => {
      try {
        // Add immediate UI feedback via Socket.IO
        io.to(userId.toString()).emit('anonymous-mode-update', {
          anonymousMode: user.anonymousMode
        });

        // Force nearby users refresh immediately via Socket.IO
        io.to(userId.toString()).emit('refresh-nearby-users');
      } catch (socketError) {
        console.error('Socket notification error:', socketError);
      }
    });

  } catch (error) {
    console.error('Toggle anonymous mode error:', error);
    return res.status(500).json({ error: 'An error occurred' });
  }
});

// Like/unlike a post
app.post('/api/post/:postId/like', isAuthenticated, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.session.userId;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user already liked the post
    const userLiked = post.likes.includes(userId);

    if (userLiked) {
      // Unlike post
      post.likes = post.likes.filter(id => id.toString() !== userId.toString());
      await post.save();
      return res.status(200).json({ liked: false });
    } else {
      // Like post
      post.likes.push(userId);
      await post.save();
      return res.status(200).json({ liked: true });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Comment on a post
app.post('/api/post/:postId/comment', isAuthenticated, async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.session.userId;

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    post.comments.push({
      user: userId,
      text,
      timestamp: new Date()
    });

    await post.save();

    res.status(201).json({ message: 'Comment added successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a post (only allowed for the post creator)
app.delete('/api/post/:postId', isAuthenticated, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.session.userId;

    // Find the post
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if the user is the post creator
    if (post.user.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    // Delete the post
    await Post.findByIdAndDelete(postId);

    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: error.message || 'An error occurred while deleting the post' });
  }
});

app.get('/api/user/:userId', isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user is anonymous, return limited information
    // Unless the requester is the user themselves
    if (user.anonymousMode && req.session.userId !== userId) {
      return res.status(200).json({
        _id: user._id,
        username: 'Anonymous User',
        fullName: 'Anonymous User',
        bio: 'This user is in anonymous mode',
        profilePicture: null, // Explicitly set to null for anonymous users
        isAnonymous: true
      });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/connection-status/:userId', isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;

    const request = await Request.findOne({
      $or: [
        { from: req.session.userId, to: userId },
        { from: userId, to: req.session.userId }
      ]
    });

    if (!request) {
      return res.status(200).json({ status: 'not_connected' });
    }

    res.status(200).json({ status: request.status });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/conversations', isAuthenticated, async (req, res) => {
  try {
    // Get all users with accepted connection requests
    const connections = await Request.find({
      $or: [
        { from: req.session.userId },
        { to: req.session.userId }
      ],
      status: 'accepted'
    });

    const connectedUserIds = connections.map(conn => 
      conn.from.toString() === req.session.userId.toString() ? conn.to : conn.from
    );

    // Get connected users' info
    const users = await User.find({
      _id: { $in: connectedUserIds }
    }).select('-password');

    // Get last message for each conversation
    const conversationsWithLastMessage = await Promise.all(users.map(async user => {
      const lastMessage = await Message.findOne({
        $or: [
          { from: req.session.userId, to: user._id },
          { from: user._id, to: req.session.userId }
        ]
      }).sort('-timestamp').limit(1);

      // If user is in anonymous mode, anonymize their data
      if (user.anonymousMode) {
        const anonymousUser = {
          _id: user._id,
          username: 'Anonymous User',
          fullName: 'Anonymous User',
          profilePicture: '',
          isAnonymous: true
        };

        return {
          user: anonymousUser,
          lastMessage
        };
      }

      return {
        user,
        lastMessage
      };
    }));

    res.status(200).json(conversationsWithLastMessage);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/profile', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password').lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation Error', details: err.message });
  }

  if (err.name === 'MongoError' && err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate Entry', details: 'This record already exists' });
  }

  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  res.status(500).json({ error: 'Internal Server Error', message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong' });
});

// Get all users for search functionality
app.get('/api/users/search', isAuthenticated, async (req, res) => {
  try {
    // Set cache headers to prevent stale data during anonymous mode changes
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Get all users except the current user
    const users = await User.find({
      _id: { $ne: req.session.userId }
    }).select('username fullName profilePicture anonymousMode verified');

    // Return users with anonymized data where needed
    const sanitizedUsers = users.map(user => {
      // Convert to plain object
      const userObj = user.toObject();

      // If user is in anonymous mode, anonymize their data
      if (userObj.anonymousMode) {
        return {
          _id: userObj._id,
          username: 'Anonymous User',
          fullName: 'Anonymous User',
          profilePicture: null,
          isAnonymous: true,
          verified: false // Don't show verified status for anonymous users
        };
      }

      return userObj;
    });

    res.status(200).json(sanitizedUsers);
  } catch (error) {
    console.error('Get users for search error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Server-side user search API for direct searches
app.get('/api/search-users', isAuthenticated, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Perform case-insensitive search on username and fullName
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { fullName: { $regex: query, $options: 'i' } }
      ]
    })
    .select('username fullName profilePicture anonymousMode verified')
    .limit(20);

    // Return users with anonymized data where needed
    const sanitizedUsers = users.map(user => {
      // Convert to plain object
      const userObj = user.toObject();

      // If user is in anonymous mode, anonymize their data
      if (userObj.anonymousMode) {
        return {
          _id: userObj._id,
          username: 'Anonymous User',
          fullName: 'Anonymous User',
          profilePicture: null,
          isAnonymous: true,
          verified: false // Don't show verified status for anonymous users
        };
      }

      return userObj;
    });

    res.status(200).json(sanitizedUsers);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});


// Socket.IO connection
io.on('connection', (socket) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`New socket connection: ${socket.id}`);
  }

  socket.on('authenticate', async (userId) => {
    if (!userId) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Authentication failed: no userId provided');
      }
      socket.emit('auth_error', { error: 'User ID required' });
      return;
    }

    try {
      // Verify user exists in database - include warnings in single query
      const user = await User.findById(userId).select('username banned warnings').lean();
      if (!user) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`Authentication failed: user ${userId} not found`);
        }
        socket.emit('auth_error', { error: 'User not found' });
        return;
      }

      if (user.banned) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`Authentication failed: user ${userId} is banned`);
        }
        socket.emit('auth_error', { error: 'User is banned' });
        return;
      }

      // Join a room with the user's ID for private messages
      socket.join(userId.toString());

      // Store userId in socket for reference
      socket.userId = userId.toString();
      socket.username = user.username;

      if (process.env.NODE_ENV !== 'production') {
        console.log(`User ${userId} (${user.username}) connected via socket ${socket.id}`);
      }

      // Acknowledge successful authentication
      socket.emit('auth_success', { status: 'connected', userId: userId });

    // Check for pending connection requests and notifications
      try {
        // Find all pending requests for this user
        const pendingRequests = await Request.find({
          to: userId,
          status: 'pending'
        }).populate('from', 'username fullName profilePicture').lean();

        // Find all pending notifications for this user (excluding warnings)
        const pendingNotifications = await PendingNotification.find({
          userId: userId
        }).lean();

        // Get undelivered warnings using new system
        const undeliveredWarnings = await WarningNotificationSystem.getUndeliveredWarnings(userId);

        if (pendingRequests.length > 0 || pendingNotifications.length > 0 || undeliveredWarnings.length > 0) {
          // Delay a bit to ensure client is ready
          setTimeout(async () => {
            // Send notifications for each pending request
            pendingRequests.forEach(request => {
              socket.emit('new-request', {
                requestId: request._id,
                fromUserId: request.from._id,
              });
            });

            // Send pending notifications and collect IDs for cleanup
            const notificationIdsToDelete = [];
            pendingNotifications.forEach(notification => {
              socket.emit('notification', {
                type: notification.type,
                title: notification.title,
                message: notification.message,
                data: notification.data
              });
              notificationIdsToDelete.push(notification._id);
            });

            // Send undelivered warnings and mark as delivered
            if (undeliveredWarnings.length > 0) {
              const warningIds = [];
              undeliveredWarnings.forEach(warning => {
                socket.emit('warning', {
                  id: warning._id.toString(),
                  message: warning.message,
                  timestamp: warning.timestamp,
                  type: 'warning'
                });
                warningIds.push(warning._id.toString());
              });

              // Mark warnings as delivered using new system
              await WarningNotificationSystem.markWarningsAsDelivered(userId, warningIds);
            }

            // Clean up delivered notifications immediately after sending
            if (notificationIdsToDelete.length > 0) {
              try {
                await PendingNotification.deleteMany({
                  _id: { $in: notificationIdsToDelete }
                });
                if (process.env.NODE_ENV !== 'production') {
                  console.log(`Cleaned up ${notificationIdsToDelete.length} delivered notifications for user ${userId}`);
                }
              } catch (err) {
                console.error('Error cleaning up delivered notifications:', err);
              }
            }
          }, 2000); // Wait 2 seconds after connection to send pending items
        }
      } catch (err) {
        console.error('Error checking pending requests and notifications:', err);
      }
    } catch (error) {
      console.error('Socket authentication error:', error);
      socket.emit('auth_error', { error: 'Authentication failed' });
    }
  });

  socket.on('disconnect', (reason) => {
    if (process.env.NODE_ENV !== 'production') {
      if (socket.userId && socket.username) {
        console.log(`User ${socket.userId} (${socket.username}) disconnected: ${reason}`);
      } else {
        console.log(`Socket ${socket.id} disconnected: ${reason}`);
      }
    }
  });

  // Ping-pong to verify connection and room membership
  socket.on('ping', (data, callback) => {
    if (callback && typeof callback === 'function') {
      callback({ status: 'ok', rooms: Array.from(socket.rooms) });
    }
  });

  // Debug room membership
  socket.on('check_room', (roomId, callback) => {
    const clients = io.sockets.adapter.rooms.get(roomId);
    const numClients = clients ? clients.size : 0;

    if (callback && typeof callback === 'function') {
      callback({ 
        room: roomId, 
        members: numClients,
        socketInRoom: socket.rooms.has(roomId)
      });
    }
  });
});

// Push notification routes
app.get('/api/push-key', (req, res) => {
  if (!vapidKeys.publicKey) {
    return res.status(500).json({ error: 'VAPID public key not available' });
  }
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/push-subscribe', isAuthenticated, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) {
      return res.status(400).json({ error: 'Subscription data is required' });
    }

    // Save subscription to user record
    await User.findByIdAndUpdate(req.session.userId, {
      pushSubscription: subscription
    });

    res.status(200).json({ message: 'Push subscription saved successfully' });
  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

// Acknowledge warning endpoint - using new warning system
app.post('/api/acknowledge-warning', isAuthenticated, async (req, res) => {
  try {
    const { warningId } = req.body;

    if (!warningId) {
      return res.status(400).json({ error: 'Warning ID is required' });
    }

    const result = await WarningNotificationSystem.acknowledgeWarning(req.session.userId, warningId);

    res.status(200).json({ 
      message: 'Warning acknowledged successfully',
      warningId: result.warningId
    });
  } catch (error) {
    console.error('Error acknowledging warning:', error);

    if (error.message.includes('Invalid warning ID')) {
      return res.status(400).json({ error: error.message });
    }

    if (error.message.includes('not found') || error.message.includes('already acknowledged')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to acknowledge warning' });
  }
});

// Pending notifications endpoint for polling (fallback for browsers without Push API)
app.get('/api/pending-notifications', isAuthenticated, async (req, res) => {
  try {
    // Get stored pending notifications (EXCLUDING warnings - they use separate system)
    const storedNotifications = await PendingNotification.find({
      userId: req.session.userId,
      type: { $ne: 'warning' } // Explicitly exclude warning type
    }).sort('-createdAt').limit(20).lean();

    // Get recent connection requests
    const pendingRequests = await Request.find({
      to: req.session.userId,
      status: 'pending'
    }).populate('from', 'username fullName').sort('-createdAt').limit(5).lean();

    // Get only unread messages
    const recentMessages = await Message.find({
      to: req.session.userId,
      read: { $ne: true }
    }).populate('from', 'username fullName').sort('-timestamp').limit(5).lean();

    // Get undelivered warnings using new system
    // Always check for warnings but filter out those already delivered via socket
    const undeliveredWarnings = await WarningNotificationSystem.getUndeliveredWarnings(req.session.userId);

    // Filter out warnings that were recently delivered via socket
    const filteredWarnings = undeliveredWarnings.filter(warning => {
      // Only include warnings that are truly undelivered
      return !warning.delivered && !warning.acknowledged;
    });

    // Format notifications (warnings handled separately)
    const notifications = [
      ...storedNotifications.map(notif => ({
        id: `stored_${notif._id}`,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        data: notif.data || {},
        createdAt: notif.createdAt
      })),
      ...pendingRequests.map(req => ({
        id: `req_${req._id}`,
        title: 'New Connection Request',
        message: `${req.from.fullName || req.from.username} wants to connect with you!`,
        type: 'request',
        data: { requestId: req._id, fromUserId: req.from._id },
        createdAt: req.createdAt
      })),
      ...recentMessages.map(msg => ({
        id: `msg_${msg._id}`,
        title: `New message from ${msg.from.fullName || msg.from.username}`,
        message: msg.content,
        type: 'message',
        data: { messageId: msg._id, fromUserId: msg.from._id },
        createdAt: msg.timestamp
      })),
      ...filteredWarnings.map(warning => ({
        id: warning._id.toString(),
        title: 'Admin Warning',
        message: warning.message,
        type: 'warning',
        data: { 
          type: 'warning',
          timestamp: warning.timestamp,
          warningId: warning._id
        },
        createdAt: warning.timestamp
      }))
    ];

    // Mark filtered warnings as delivered via polling if any were included
    if (filteredWarnings.length > 0) {
      const warningIds = filteredWarnings.map(w => w._id.toString());
      await WarningNotificationSystem.markWarningsAsDelivered(req.session.userId, warningIds);
    }

    // Sort by creation date and limit for better performance
    const sortedNotifications = notifications
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);

    res.status(200).json(sortedNotifications);
  } catch (error) {
    console.error('Error fetching pending notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notifications as read
app.post('/api/mark-notifications-read', isAuthenticated, async (req, res) => {
  try {
    // Mark all unread messages as read
    await Message.updateMany(
      { to: req.session.userId, read: { $ne: true } },
      { $set: { read: true } }
    );

    // You could also mark connection requests as acknowledged here

    res.status(200).json({ message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// Helper function to send push notification
async function sendPushNotification(userId, title, message, url = '/', isAnonymous = false, type = 'default') {
  try {
    const user = await User.findById(userId);

    if (!user) {
      console.log(`User not found: ${userId}`);
      return false;
    }

    if (!user.pushSubscription) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`No push subscription found for user ${userId} (${user.username || 'Unknown'}). User needs to enable notifications.`);
      }
      // Don't return false here - continue to try other notification methods
    }

    const notificationData = {
      title,
      body: message,
      message,
      url,
      type,
      timestamp: new Date(),
      isAnonymous: isAnonymous,
      data: {
        type,
        fromUserId: userId,
        url,
        timestamp: new Date().toISOString()
      }
    };

    // If the user has a push subscription, try to send via web push
    if (user.pushSubscription && user.pushSubscription.endpoint) {
      try {
        const payload = JSON.stringify(notificationData);
        await webpush.sendNotification(user.pushSubscription, payload);
        if (process.env.NODE_ENV !== 'production') {
          console.log(`Push notification sent successfully to user ${userId}`);
        }
        return true;
      } catch (pushError) {
        console.error('Push notification failed:', pushError.message);
        // Continue to fallback methods
      }
    }

    // Fallback: notification will be picked up by polling
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Push notification stored for polling for user ${userId}`);
    }
    return true;
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return false;
  }
}

// Health check endpoint for production monitoring
app.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    memory: process.memoryUsage(),
    version: require('./package.json').version,
    port: PORT,
    host: HOST
  };

  // Return 503 if database is not connected
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      ...health,
      status: 'UNHEALTHY',
      error: 'Database connection lost'
    });
  }

  res.status(200).json(health);
});

// API info endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    name: 'Zync API',
    version: require('./package.json').version,
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/health',
      auth: '/api/login',
      register: '/api/register',
      profile: '/api/profile',
      nearby: '/api/nearby',
      posts: '/api/posts',
      messages: '/api/message'
    }
  });
});

// Admin routes
// Admin dashboard HTML route (protected)
app.get('/help-services', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'zync-help-services.html'));
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Hash the provided password
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    if (username === ADMIN_USERNAME && hashedPassword === ADMIN_PASSWORD_HASH) {
      req.session.adminToken = ADMIN_TOKEN_SECRET;
      res.status(200).json({ 
        message: 'Admin login successful',
        redirectUrl: '/help-services'
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/check', adminAuth, (req, res) => {
  res.status(200).json({ isAdmin: true });
});

// Admin dashboard data
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes for active status

    // Get currently connected socket users
    const connectedSockets = await io.sockets.sockets;
    const onlineUserIds = new Set();

    // Get online users from socket connections
    for (const [_, socket] of connectedSockets) {
      if (socket.userId) {
        onlineUserIds.add(socket.userId);
      }
    }

    // Convert Set to Array for MongoDB query
    const onlineUserIdArray = Array.from(onlineUserIds);

    // Optimize stats queries with better error handling
    let stats;
    try {
      stats = await Promise.all([
        User.countDocuments({ deleted: { $ne: true } }),
        User.countDocuments({
          $or: [
            { _id: { $in: onlineUserIdArray } },
            { 'lastLocation.lastUpdated': { $gte: activeThreshold } }
          ],
          banned: { $ne: true },
          deleted: { $ne: true }
        }),
        User.countDocuments({ 
          createdAt: { $gte: sevenDaysAgo },
          deleted: { $ne: true }
        }),
        User.countDocuments({ 
          banned: true,
          deleted: { $ne: true }
        }),
        User.countDocuments({ deleted: true }),
        User.countDocuments({
          'warnings.0': { $exists: true },
          deleted: { $ne: true }
        }),
        User.countDocuments({ 
          verified: true,
          deleted: { $ne: true }
        }),
        Post.countDocuments({ deleted: { $ne: true } }),
        Message.countDocuments()
      ]);
    } catch (error) {
      console.error('Stats query error:', error);
      throw new Error('Failed to fetch statistics');
    }

    const [
      totalUsers,
      recentActiveUsers,
      newUsers,
      bannedUsers,
      deletedUsers,
      warnedUsers,
      verifiedUsers,
      totalPosts,
      totalMessages
    ] = stats;

    // Calculate active users (combine socket connections and recent activity)
    const activeUsers = recentActiveUsers;
    const onlineUsers = onlineUserIdArray.length;

    // Get system status
    const systemStatus = {
      database: mongoose.connection.readyState === 1,
      webSocket: io.engine.clientsCount > 0,
      webServer: true
    };

    res.status(200).json({
      totalUsers,
      activeUsers,
      newUsers,
      bannedUsers,
      deletedUsers,
      warnedUsers,
      verifiedUsers,
      totalPosts,
      totalMessages,
      onlineUsers,
      systemStatus
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Add endpoint for recent users
// User management endpoints
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find()
      .select('username fullName profilePicture createdAt lastLocation banned verified')
      .sort('-createdAt');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get specific user details for admin
app.get('/api/admin/user-status/:userId', adminAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const room = io.sockets.adapter.rooms.get(userId.toString());
    const hasActiveSocket = room ? room.size > 0 : false;
    res.json({ hasActiveSocket });
  } catch (error) {
    console.error('Error checking user status:', error);
    res.status(500).json({ error: 'Failed to check user status' });
  }
});

// Get user posts for admin
app.get('/api/admin/users/:userId/posts', adminAuth, async (req, res) => {
  try {
    const posts = await Post.find({ user: req.params.userId })
      .sort('-createdAt')
      .lean();

    res.status(200).json(posts);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

app.delete('/api/admin/post/:postId', adminAuth, async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

app.get('/api/admin/users/:userId', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('username fullName profilePicture createdAt lastLocation banned verified anonymousMode email ip')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Format the IP address properly
    let formattedIp = user.ip;
    if (!formattedIp || formattedIp === 'unknown') {
      // Try to find the most recent IP from their session data
      const sessions = await mongoose.connection.db.collection('sessions')
        .find({ 'session.userId': user._id.toString() })
        .sort({ 'session.lastActive': -1 })
        .limit(1)
        .toArray();

      if (sessions.length > 0 && sessions[0].session.ip) {
        formattedIp = sessions[0].session.ip;
      }
    }

    // Ensure IP is included in response with proper formatting
    const userData = {
      ...user,
      ip: formattedIp || 'Not available'
    };

    res.status(200).json(userData);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Add missing endpoint for user posts
app.get('/api/user/:userId/posts', isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get posts from this user with optimized query
    const posts = await Post.find({ user: userId, deleted: { $ne: true } })
      .populate('user', 'username fullName profilePicture verified anonymousMode')
      .select('content image likes comments createdAt user')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.status(200).json(posts);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

app.post('/api/admin/user/:userId/ban', adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { banned: true },
      { new: true }
    );
    res.status(200).json({ message: 'User banned successfully', user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

app.post('/api/admin/user/:userId/unban', adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { banned: false },
      { new: true }
    );
    res.status(200).json({ message: 'User unbanned successfully', user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

app.post('/api/admin/user/:userId/warn', adminAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Warning message is required' });
    }

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const result = await WarningNotificationSystem.sendWarningToUser(
      req.params.userId, 
      message.trim(), 
      req.session.adminId || 'admin'
    );

    res.status(200).json({ 
      message: 'Warning sent successfully',
      warningId: result.warningId,
      deliveredImmediately: result.delivered
    });
  } catch (error){
    console.error('Warning error:', error);

    if (error.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(500).json({ error: 'Failed to send warning' });
  }
});

app.post('/api/admin/user/:userId/verify', adminAuth, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Validate user ID format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    // Check if user exists and is not deleted
    const existingUser = await User.findOne({
      _id: userId,
      deleted: { $ne: true }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found or has been deleted' });
    }

    // Check if user is already verified
    if (existingUser.verified) {
      return res.status(400).json({ error: 'User is already verified' });
    }

    // Update user verification status
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        verified: true,
        verifiedAt: new Date(),
        verifiedBy: req.session.adminId || 'admin'
      },
      { new: true }
    );

    // Log verification action for audit
    if (process.env.NODE_ENV !== 'production') {
      console.log(`User ${user.username} (${userId}) verified by admin at ${new Date()}`);
    }

    // Send notification to user if they're online
    const room = io.sockets.adapter.rooms.get(userId.toString());
    if (room && room.size > 0) {
      io.to(userId.toString()).emit('verification-status', {
        verified: true,
        message: 'Congratulations! Your account has been verified.'
      });
    }

    res.status(200).json({ 
      message: 'User verified successfully', 
      user: {
        _id: user._id,
        username: user.username,
        verified: user.verified,
        verifiedAt: user.verifiedAt
      }
    });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({ error: 'Failed to verify user' });
  }
});

app.post('/api/admin/user/:userId/unverify', adminAuth, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Validate user ID format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    // Check if user exists and is not deleted
    const existingUser = await User.findOne({
      _id: userId,
      deleted: { $ne: true }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found or has been deleted' });
    }

    // Check if user is not verified
    if (!existingUser.verified) {
      return res.status(400).json({ error: 'User is not verified' });
    }

    // Update user verification status
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        verified: false,
        $unset: { 
          verifiedAt: 1,
          verifiedBy: 1
        }
      },
      { new: true }
    );

    // Log unverification action for audit
    if (process.env.NODE_ENV !== 'production') {
      console.log(`User ${user.username} (${userId}) verification removed by admin at ${new Date()}`);
    }

    // Send notification to user if they're online
    const room = io.sockets.adapter.rooms.get(userId.toString());
    if (room && room.size > 0) {
      io.to(userId.toString()).emit('verification-status', {
        verified: false,
        message: 'Your account verification has been removed.'
      });
    }

    res.status(200).json({ 
      message: 'User verification removed successfully', 
      user: {
        _id: user._id,
        username: user.username,
        verified: user.verified
      }
    });
  } catch (error) {
    console.error('Unverify user error:', error);
    res.status(500).json({ error: 'Failed to remove user verification' });
  }
});

app.delete('/api/admin/user/:userId', adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.userId);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.get('/api/admin/recent-users', adminAuth, async (req, res) => {
  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const onlineThreshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes threshold

    const users = await User.find({
      createdAt: { $gte: fortyEightHoursAgo }
    })
      .select('username profilePicture createdAt lastLocation')
      .sort('-createdAt');

    const connectedSockets = await io.sockets.sockets;
    const onlineUserIds = new Set();

    // Get currently connected user IDs from socket connections
    for (const [_, socket] of connectedSockets) {
      if (socket.userId) {
        onlineUserIds.add(socket.userId);
      }
    }

    const formattedUsers = users.map(user => {
      const lastActive = user.lastLocation?.lastUpdated ? new Date(user.lastLocation.lastUpdated) : null;
      const isOnline = onlineUserIds.has(user._id.toString()) || 
                      (lastActive && lastActive >= onlineThreshold);

      return {
        username: user.username,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt,
        status: isOnline ? 'Online' : 'Offline',
        lastActive: lastActive ? lastActive.toISOString() : null
      };
    });

    res.status(200).json(formattedUsers);
  } catch (error) {
    console.error('Error fetching recent users:', error);
    res.status(500).json({ error: 'Failed to fetch recent users' });
  }
});

// Password reset page route
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'reset-password.html'));
});

// Serve the main HTML file for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Production-ready port configuration for Render and Replit
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 10000 : 5000);
const HOST = '0.0.0.0'; // Always bind to 0.0.0.0 for deployment

// Graceful shutdown handler
const shutdown = async () => {
  console.log('Initiating graceful shutdown...');
  try {
    await server.close();
    console.log('Server shut down');
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server only after database connection
async function startServer() {
  const dbConnected = await connectToDatabase();

  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }

  server.listen(PORT, HOST, () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const renderUrl = process.env.RENDER_EXTERNAL_URL;
    
    console.log(`Zync server running on ${HOST}:${PORT} (${process.env.NODE_ENV || 'development'} mode)`);

    if (isProduction || renderUrl) {
      console.log(`Production server running on port ${PORT}`);
      console.log(`Base URL: ${process.env.BASE_URL || renderUrl || 'http://localhost:' + PORT}`);
    } else {
      console.log(`Development server accessible at: http://localhost:${PORT}`);
    }
  });
}

// Start the server
startServer();

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

// Improved Socket.IO error handling
io.on('error', (err) => {
  console.error('Socket.IO error:', err);
});

const stateChangingRoutes = [
  '/api/register',
  '/api/login',
  '/api/logout',
  '/api/profile',
  '/api/location',
  '/api/request',
  '/api/post',
  '/api/message',
  '/api/search-users' // Add new search endpoint to state-changing routes
];