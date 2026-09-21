// Simple in-memory OTP store.
//
// Good enough for a single-server demo/small deployment. For production with
// multiple server instances, swap this for Redis (or a "otps" table in your
// database) so codes are visible to every instance behind your load balancer.

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 3;

const store = new Map(); // email -> { code, expiresAt, attempts }

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function setOtp(email) {
  const code = generateCode();
  store.set(email, { code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
  return code;
}

function verifyOtp(email, code) {
  const entry = store.get(email);
  if (!entry) return { ok: false, reason: 'not_found' };
  if (Date.now() > entry.expiresAt) {
    store.delete(email);
    return { ok: false, reason: 'expired' };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(email);
    return { ok: false, reason: 'too_many_attempts' };
  }
  entry.attempts += 1;
  if (entry.code !== code) return { ok: false, reason: 'mismatch' };
  store.delete(email);
  return { ok: true };
}

module.exports = { setOtp, verifyOtp };
