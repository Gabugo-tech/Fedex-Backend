const supabase = require('../db/supabase');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nnanwubagabriel@gmail.com';

async function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';

  // Fix #27: case-insensitive Bearer token extraction
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : '';

  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
    if (user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}

module.exports = adminAuth;
