import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** बिल-जाँच वाले पेज का पता — settings में website भरी हो तभी */
export function billVerifyUrl(settings, barcode) {
  const site = String((settings && settings.websiteUrl) || '').trim().replace(/\/+$/, '');
  if (!site || !barcode) return '';
  return `${site}/#/verify/${barcode}`;
}

/**
 * बिल पर छपने वाला QR (PNG data URL). ग्राहक मोबाइल से स्कैन करे तो दुकान की website पर
 * "यह बिल असली है" वाला पेज खुलता है. website का पता न भरा हो तो खाली — तब QR नहीं छपता.
 */
export function useBillQr(settings, barcode) {
  const url = billVerifyUrl(settings, barcode);
  const [qr, setQr] = useState('');

  useEffect(() => {
    let alive = true;
    if (!url) {
      setQr('');
      return undefined;
    }
    QRCode.toDataURL(url, { margin: 0, width: 240, errorCorrectionLevel: 'M' })
      .then((dataUrl) => { if (alive) setQr(dataUrl); })
      .catch(() => { if (alive) setQr(''); });
    return () => { alive = false; };
  }, [url]);

  return qr;
}
