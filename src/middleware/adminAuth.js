const supabase = require('../db/supabase');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

if (!ADMIN_EMAIL) {
  console.error('[adminAuth] ADMIN_EMAIL env var is not set. All admin requests will be rejected.');
}

async function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';

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
    if (!ADMIN_EMAIL || user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}

module.exports = adminAuth;

