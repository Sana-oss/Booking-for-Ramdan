const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Security: Check for JWT_SECRET environment variable
// Use fallback only in development with a strong warning
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production-change-this';

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: JWT_SECRET is not set in environment variables.');
  console.warn('⚠️  Using development fallback secret. SET JWT_SECRET for production!');
  console.warn('⚠️  Add JWT_SECRET=your-secure-random-string to your .env file.');
}

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No authentication token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findById(decoded.id);

    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: 'Invalid authentication token' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.admin.role !== 'admin' && req.admin.role !== 'superadmin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (req.admin.role !== 'superadmin') {
    return res.status(403).json({ message: 'Super admin access required' });
  }
  next();
};

// Staff can update status but not delete
const requireStaff = (req, res, next) => {
  if (req.admin.role !== 'admin' && req.admin.role !== 'superadmin' && req.admin.role !== 'staff') {
    return res.status(403).json({ message: 'Staff access required' });
  }
  next();
};

module.exports = {
  auth,
  requireAdmin,
  requireSuperAdmin,
  requireStaff
};
