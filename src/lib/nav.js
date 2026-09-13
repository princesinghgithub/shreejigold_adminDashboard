// एक पेज से दूसरे पर भेजने का छोटा रास्ता — modal के अंदर से भी.
// (पूरा router नहीं डाला; ऐप में पेज सिर्फ एक state है, App.jsx का Shell उसे बदलता है)

let pendingCustomerId = null;

/** ग्राहक का खाता खुला हो और "नया बिल" दबाएं — बिलिंग पेज उसी ग्राहक के साथ खुले */
export function goToBillingFor(customerId) {
  pendingCustomerId = customerId || null;
  window.dispatchEvent(new CustomEvent('go-view', { detail: { view: 'billing', customerId } }));
}

/** बिलिंग पेज खुलते ही यह पढ़कर खाली कर देता है — एक बार का काम है */
export function takePendingCustomer() {
  const v = pendingCustomerId;
  pendingCustomerId = null;
  return v;
}
