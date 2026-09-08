import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'chitchat_secret_key_123';

/**
 * Sign JWT token for user
 */
export const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
};

/**
 * Authentication middleware enforcing strict session validation
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired authentication token.' });
    }

    // Ensure user ID is a valid number
    const userId = parseInt(decoded.id, 10);
    if (isNaN(userId) || userId <= 0) {
      return res.status(403).json({ error: 'Malformed token payload.' });
    }

    req.user = { id: userId };
    next();
  });
};

export default { authenticateToken, generateToken, JWT_SECRET };
