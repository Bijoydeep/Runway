const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { setOtp, verifyOtp } = require('../services/otpStore');
const { sendOtpEmail } = require('../services/emailService');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Limit OTP requests per IP to slow down abuse of the email-sending endpoint.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { error: 'Too many codes requested. Try again in a few minutes.' },
});

router.post('/request-otp', otpLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

  try {
    const code = setOtp(email);
    await sendOtpEmail(email, code);
    res.json({ success: true });
  } catch (err) {
    console.error('request-otp failed:', err);
    res.status(500).json({ error: 'Could not send the code. Try again shortly.' });
  }
});

router.post('/verify-otp', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required.' });

  const result = verifyOtp(email, code);
  if (!result.ok) {
    const messages = {
      not_found: 'Request a new code first.',
      expired: 'That code expired. Request a new one.',
      too_many_attempts: 'Too many attempts. Request a new code.',
      mismatch: "That code doesn't match.",
    };
    return res.status(400).json({ error: messages[result.reason] || 'Invalid code.' });
  }

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, email });
});

module.exports = router;
