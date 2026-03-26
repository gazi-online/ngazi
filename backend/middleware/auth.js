const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

// Strict auth - requires valid token
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token)
      return res.status(401).json({ success: false, message: 'Not authorized. Please login.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, phone, email, role, isActive, isVerified, lastLogin, createdAt')
      .eq('id', decoded.id)
      .single();

    if (error || !user)
      return res.status(401).json({ success: false, message: 'User not found' });

    if (!user.isActive)
      return res.status(403).json({ success: false, message: 'Account suspended' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError')
      return res.status(401).json({ success: false, message: 'Invalid token' });
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// Optional auth - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { data: user } = await supabase
        .from('users')
        .select('id, name, phone, email, role, isActive, isVerified')
        .eq('id', decoded.id)
        .single();
      if (user) req.user = user;
    }
  } catch (err) {
    // Ignore auth errors for optional auth
  }
  next();
};

// Admin only
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin')
    return res.status(403).json({ success: false, message: 'Admin access required' });
  next();
};

module.exports = { protect, optionalAuth, adminOnly };
