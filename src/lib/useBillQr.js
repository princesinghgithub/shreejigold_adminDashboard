import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** बिल-जाँच वाले पेज का पता — settings में website भरी हो तभी */
export function billVerifyUrl(settings, barcode) {
  const site = String((settings && settings.websiteUrl) || '').trim().replace(/\/+$/, '');
  if (!site || !barcode) return '';
  return `${site}/#/verify/${barcode}`;
}

/**
 * दुकान के UPI पर भुगतान का link — वही जो Google Pay वाले QR में होता है.
 * रकम नहीं डालते, ताकि ग्राहक किस्त में भी दे सके. UPI ID खाली/गलत हो तो ''.
 */
export function upiPayUrl(settings) {
  const pa = String((settings && settings.upiId) || '').trim();
  if (!/^[\w.-]+@[\w.-]+$/.test(pa)) return '';
  const pn = String(settings.upiName || settings.shopName || '').trim();
  return `upi://pay?pa=${pa}` + (pn ? `&pn=${encodeURIComponent(pn)}` : '');
}

/** कोई भी text → QR की PNG (data URL). text खाली हो तो '' */
function useQrImage(text) {
  const [qr, setQr] = useState('');

  useEffect(() => {
    let alive = true;
    if (!text) {
      setQr('');
      return undefined;
    }
    QRCode.toDataURL(text, { margin: 0, width: 240, errorCorrectionLevel: 'M' })
      .then((dataUrl) => { if (alive) setQr(dataUrl); })
      .catch(() => { if (alive) setQr(''); });
    return () => { alive = false; };
  }, [text]);

  return qr;
}

/**
 * बिल पर छपने वाला QR (PNG data URL). ग्राहक मोबाइल से स्कैन करे तो दुकान की website पर
 * "यह बिल असली है" वाला पेज खुलता है. website का पता न भरा हो तो खाली — तब QR नहीं छपता.
 */
export function useBillQr(settings, barcode) {
  return useQrImage(billVerifyUrl(settings, barcode));
}

/** हर बिल पर "UPI से भुगतान" वाला QR — settings में UPI ID न हो तो खाली */
export function useUpiQr(settings) {
  return useQrImage(upiPayUrl(settings));
}
