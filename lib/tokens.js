const crypto = require("crypto");

const SECRET = process.env.TOKEN_SECRET || process.env.FHD_CODE || "7esen-secret";
const KEY = crypto.createHash("sha256").update(SECRET).digest();
const TTL_MS = 3600 * 1000;

function makeToken(url) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const payload = JSON.stringify({ u: url, e: Date.now() + TTL_MS });
  const enc = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function resolveToken(token) {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 28) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    const payload = decipher.update(enc, null, "utf8") + decipher.final("utf8");
    const { u, e } = JSON.parse(payload);
    if (Date.now() > e) return null;
    return u;
  } catch {
    return null;
  }
}

module.exports = { makeToken, resolveToken };
