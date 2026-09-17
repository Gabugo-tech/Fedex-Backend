const supabase = require('../db/supabase');

const ADMIN_EMAIL = 'nnanwubagabriel@gmail.com';

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

  // Verify token with Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }

  if (user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  req.user = user;
  next();
}

module.exports = adminAuth;
