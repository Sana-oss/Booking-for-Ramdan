const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Admin = require('../models/Admin');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Use same JWT_SECRET as auth middleware
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production-change-this';

// @route   POST /api/auth/login
// @desc    Admin login
// @access  Public
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, password } = req.body;

    // Find admin
    const admin = await Admin.findOne({ username, isActive: true });
    
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
        name: admin.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current admin info
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      admin: {
        id: req.admin._id,
        username: req.admin.username,
        role: req.admin.role,
        name: req.admin.name
      }
    });
  } catch (error) {
    console.error('Get admin info error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout (client-side token removal)
// @access  Private
router.post('/logout', auth, (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
