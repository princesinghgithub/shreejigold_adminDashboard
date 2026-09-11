// रकम को शब्दों में — भारतीय तरीका (Lakh / Crore), बिल पर छपने के लिए.

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function under100(n) {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = ONES[n % 10];
  return o ? t + ' ' + o : t;
}

function under1000(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let out = h ? ONES[h] + ' Hundred' : '';
  if (rest) out += (out ? ' ' : '') + under100(rest);
  return out;
}

/** 0 से 99,99,99,999 तक — Crore/Lakh/Thousand में तोड़कर */
export function numToWords(value) {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (crore) parts.push(numToWords(crore) + ' Crore');
  if (lakh) parts.push(under100(lakh) + ' Lakh');
  if (thousand) parts.push(under100(thousand) + ' Thousand');
  if (n) parts.push(under1000(n));
  return parts.join(' ');
}

/** बिल के नीचे छपने वाली लाइन — "Two Lakh ... Rupees and Fifty Paise Only" */
export function amountInWords(value) {
  const v = Math.abs(Number(value) || 0);
  const rupees = Math.floor(v + 1e-6);
  const paise = Math.round((v - rupees) * 100);
  let out = numToWords(rupees) + ' Rupees';
  if (paise > 0) out += ' and ' + numToWords(paise) + ' Paise';
  return (Number(value) < 0 ? 'Minus ' : '') + out + ' Only';
}
