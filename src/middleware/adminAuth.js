const supabase = require('../db/supabase');

// Single source of truth — also set ADMIN_EMAIL in your Render env vars
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nnanwubagabriel@gmail.com';

/**
 * Middleware: verifies the Bearer token from Supabase Auth
 * and restricts access to the admin email only.
 */
async function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  // Fix: wrap in try/catch so Supabase errors don't crash the server
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
