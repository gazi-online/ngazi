const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { protect } = require('../middleware/auth');

// Helper: generate JWT
const signToken = (userId, role) => jwt.sign(
  { id: userId, role },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

// ── REGISTER ────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password) return res.status(400).json({ success: false, message: 'All fields are required' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // Check existing
    const { data: existing } = await supabase.from('users').select('id').eq('phone', cleanPhone).single();
    if (existing) return res.status(409).json({ success: false, message: 'Phone number already registered' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase.from('users').insert({
      name: name.trim(),
      phone: cleanPhone,
      password: hashedPassword,
      role: 'user'
    }).select().single();

    if (error) throw error;

    const token = signToken(user.id, user.role);
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── LOGIN ────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ success: false, message: 'Phone and password required' });

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const { data: user, error } = await supabase.from('users').select('*').eq('phone', cleanPhone).single();
    if (!user || error) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account suspended' });

    await supabase.from('users').update({ lastLogin: new Date().toISOString() }).eq('id', user.id);

    const token = signToken(user.id, user.role);
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET ME ───────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ── SEND OTP ─────────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone required' });

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Save OTP to user document
    const { data: user, error } = await supabase.from('users').update({
      otpCode: otp,
      otpExpiresAt: expiresAt
    }).eq('phone', cleanPhone).select().single();

    if (error || !user) return res.status(404).json({ success: false, message: 'User not found' });

    // Send OTP via Fonnte (WhatsApp)
    const fonnteToken = process.env.FONNTE_TOKEN;
    if (fonnteToken) {
      const axios = require('axios');
      let target = cleanPhone;
      if (target.startsWith('0')) target = '880' + target.substring(1);
      const message = `আপনার গাজী অনলাইন ভেরিফিকেশন কোড: ${otp}\nকোডটি কারো সাথে শেয়ার করবেন না।`;
      
      await axios.post('https://api.fonnte.com/send', {
        target: target,
        message: message,
        delay: '2',
        countryCode: '880'
      }, { headers: { Authorization: fonnteToken } }).catch(e => {
        console.error('Fonnte send error:', e?.response?.data || e.message);
      });
    }

    console.log(`OTP for ${cleanPhone}: ${otp}`); // Dev only fallback
    res.json({ success: true, message: 'OTP sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── VERIFY OTP ───────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ success: false, message: 'Phone and OTP required' });

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const { data: user, error } = await supabase.from('users').select('*').eq('phone', cleanPhone).single();
    if (!user || error) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.otpCode || user.otpCode !== otp)
      return res.status(401).json({ success: false, message: 'Invalid OTP' });

    if (new Date() > new Date(user.otpExpiresAt))
      return res.status(401).json({ success: false, message: 'OTP expired' });

    // Clear OTP and set verified
    await supabase.from('users').update({
      otpCode: null,
      otpExpiresAt: null,
      isVerified: true
    }).eq('id', user.id);

    const token = signToken(user.id, user.role);
    res.json({ success: true, token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
