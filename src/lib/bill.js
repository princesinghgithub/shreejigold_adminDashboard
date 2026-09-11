// बिल पर छपने वाली छोटी चीज़ें — दोनों templates, WhatsApp और scan सब एक जैसा दिखाएं.

// सर्वर (backend का lib/schemas.js → PAYMENT_MODES) भी यही ids मानता है
export const PAYMENT_MODES = [
  { id: 'cash', label: 'Cash / नकद' },
  { id: 'upi', label: 'UPI' },
  { id: 'neft', label: 'NEFT / RTGS' },
  { id: 'netbanking', label: 'Net Banking' },
  { id: 'card', label: 'Card' },
  { id: 'cheque', label: 'Cheque' },
];

export const modeLabel = (id) => (PAYMENT_MODES.find((m) => m.id === id) || { label: id }).label;

// Income Tax: एक बिल पर ₹2 लाख या ज़्यादा नकद लेना मना (धारा 269ST),
// और ₹2 लाख से ऊपर के बिल पर ग्राहक का PAN / Form 60 (नियम 114B)
export const CASH_LIMIT = 200000;
export const PAN_LIMIT = 200000;

/** बिल पर छपा नंबर — पुराने बिलों में billNo नहीं, तब id के आखिरी 6 अक्षर */
export function billNoOf(inv) {
  return inv.billNo || String(inv.id || '').slice(-6).toUpperCase();
}

/** "12:53 pm" — बिल बनने का समय, भारत के समय से */
export function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
}

const KARATS = [[99.9, '24K'], [91.6, '22K'], [83.3, '20K'], [75, '18K'], [58.5, '14K']];

/** 91.6 → "GOLD 22K", चांदी → "SILVER 92.5" */
export function karatLabel(metal, purity) {
  const p = Number(purity) || 0;
  if (metal === 'Silver') return p ? `SILVER ${p}` : 'SILVER';
  const k = KARATS.find(([v]) => Math.abs(p - v) <= 0.6);
  return k ? `GOLD ${k[1]}` : `GOLD ${p}%`;
}

/** भुगतान तरीके-वार जोड़ (नकद ₹50,000, UPI ₹20,000). पुराने बिलों का जो हिस्सा बिना तरीके के है वो "प्राप्त" */
export function paymentRows(inv) {
  const byMode = new Map();
  for (const p of inv.payments || []) {
    byMode.set(p.mode, (byMode.get(p.mode) || 0) + (Number(p.amount) || 0));
  }
  const rows = PAYMENT_MODES
    .filter((m) => byMode.get(m.id) > 0)
    .map((m) => ({ label: m.label, amount: byMode.get(m.id) }));
  const listed = rows.reduce((s, r) => s + r.amount, 0);
  const rest = Math.round(((Number(inv.paid) || 0) - listed) * 100) / 100;
  if (rest > 0) rows.push({ label: rows.length ? 'अन्य' : 'प्राप्त', amount: rest });
  return rows;
}
