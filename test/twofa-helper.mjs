// टेस्ट के लिए फ़ोन वाले Google Authenticator की जगह — मालिक/Admin के लॉगिन का 6 अंकों का कोड.
// secret एक temp फाइल में रहता है ताकि api-wiring और pages-render दोनों एक ही live-server पर चल सकें.
// live-server दोबारा चालू करें तो पहला लॉगिन नया QR (secret) देता है और यह फाइल अपने आप बदल जाती है.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FILE = path.join(os.tmpdir(), 'shreeji-e2e-2fa.json');
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(str) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of str.toUpperCase().replace(/[\s=]/g, '')) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; value &= (1 << bits) - 1; }
  }
  return Buffer.from(out);
}

function hotp(secret, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 1e6).padStart(6, '0');
}

const load = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const save = (all) => fs.writeFileSync(FILE, JSON.stringify(all));
const nowStep = () => Math.floor(Date.now() / 30000);

export function rememberSecret(secret, who = 'owner') {
  const all = load();
  all[who] = { secret, lastStep: 0 };
  save(all);
}

/** अगला कोड — एक ही step दोबारा नहीं चलता, खत्म हों तो अगले 30 सेकंड तक रुकते हैं */
export async function nextCode(who = 'owner') {
  const all = load();
  const st = all[who];
  if (!st) throw new Error('Authenticator secret नहीं मिला — backend का live-server दोबारा चालू करें');
  const step = Math.max(nowStep(), st.lastStep + 1);
  while (step > nowStep() + 1) await new Promise((r) => setTimeout(r, 500));
  st.lastStep = step;
  save(all);
  return hotp(st.secret, step);
}
