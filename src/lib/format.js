// तारीख हमेशा भारत के समय (IST) से — UTC लेते तो रात 12 से सुबह 5:30 तक के बिल
// पिछले दिन में चले जाते. सर्वर (backend का lib/helpers.js) भी यही करता है.
export function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function daysAgo(n) {
  const d = new Date(todayStr() + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function inr(n) {
  n = Number(n) || 0;
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function genBarcode() {
  let code = '';
  for (let i = 0; i < 12; i++) code += Math.floor(Math.random() * 10);
  return code;
}
