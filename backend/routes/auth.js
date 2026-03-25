const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Helper: generate JWT
const signToken = (userId, role) => jwt.sign(
  { id: userId, role },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

// ── REGISTER ────────────────────────────────────────────────────
// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    // Validate
    if (!name || !phone || !password)
      return res.status(400).json({ success: false, message: 'All fields are required' });

    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    // Check existing
    const existing = await User.findOne({ phone: phone.replace(/[^0-9]/g, '') });
    if (existing)
      return res.status(409).json({ success: false, message: 'Phone number already registered' });

    const user = await User.create({
      name: name.trim(),
      phone: phone.replace(/[^0-9]/g, ''),
      password
    });

    const token = signToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: { id: user._id, name: user.name, phone: user.phone, role: user.role }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── LOGIN ────────────────────────────────────────────────────────
// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password)
      return res.status(400).json({ success: false, message: 'Phone and password required' });

    const user = await User.findOne({ phone: phone.replace(/[^0-9]/g, '') }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    if (!user.isActive)
      return res.status(403).json({ success: false, message: 'Account suspended' });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id, user.role);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, phone: user.phone, role: user.role }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET ME ───────────────────────────────────────────────────────
// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ── SEND OTP ─────────────────────────────────────────────────────
// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // In production: send via SMS/Firebase
    // For demo: return OTP (never in production!)
    await User.findOneAndUpdate(
      { phone: phone.replace(/[^0-9]/g, '') },
      { otp: { code: otp, expiresAt } },
      { upsert: false }
    );

    console.log(`OTP for ${phone}: ${otp}`); // Dev only

    res.json({ success: true, message: 'OTP sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── VERIFY OTP ───────────────────────────────────────────────────
// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ success: false, message: 'Phone and OTP required' });

    const user = await User.findOne({ phone: phone.replace(/[^0-9]/g, '') });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.otp?.code || user.otp.code !== otp)
      return res.status(401).json({ success: false, message: 'Invalid OTP' });

    if (new Date() > user.otp.expiresAt)
      return res.status(401).json({ success: false, message: 'OTP expired' });

    user.otp = undefined;
    user.isVerified = true;
    await user.save();

    const token = signToken(user._id, user.role);
    res.json({ success: true, token, user: { id: user._id, name: user.name, role: user.role } });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
