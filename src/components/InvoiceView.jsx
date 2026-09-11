import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { fmtDate, inr } from '../lib/format';
import { useBillQr } from '../lib/useBillQr';
import { LogoWordmark } from './Logo';

export default function InvoiceView({ inv, settings }) {
  const barcodeRef = useRef(null);
  const isNonGst = inv.gstMode === 'nongst';
  const label = isNonGst ? 'ESTIMATE (Non-GST)' : (inv.type === 'sale' ? 'TAX INVOICE (Sale)' : 'PURCHASE VOUCHER');
  const barcode = inv.barcode || inv.id.replace(/\D/g, '').slice(-12).padStart(12, '0');
  const qr = useBillQr(settings, barcode);

  // canvas पर दोगुने resolution में — SVG वाला barcode PDF में नहीं आता था
  useEffect(() => {
    const el = barcodeRef.current;
    if (!el) return;
    try {
      JsBarcode(el, barcode, { format: 'CODE128', height: 68, width: 2.8, fontSize: 22, margin: 0, displayValue: true });
      el.style.width = el.width / 2 + 'px';
    } catch { /* barcode न बने तो बिल फिर भी छपे */ }
  }, [barcode]);

  return (
    <div>
      <div className="inv-head">
        <div>
          <LogoWordmark src={settings.logoUrl} />
          {settings.shopNameHindi && <div className="inv-shop-hi">{settings.shopNameHindi}</div>}
          {settings.propName && <div className="inv-prop">{settings.propName}</div>}
          <div style={{ marginTop: 4 }}>{settings.shopAddress}</div>
          {(settings.shopPhone || settings.shopPhone2) && (
            <div>मो. {[settings.shopPhone, settings.shopPhone2].filter(Boolean).join(', ')}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><b>{label}</b></div>
          <div>Invoice #: {inv.id.slice(-8).toUpperCase()}</div>
          <div>तारीख: {fmtDate(inv.date)}</div>
          <canvas ref={barcodeRef} style={{ marginTop: 6, maxWidth: 180 }} />
          {qr && (
            <div className="inv-qr">
              <img src={qr} alt="बिल जाँचें" />
              <span>स्कैन करके<br />बिल जाँचें</span>
            </div>
          )}
        </div>
      </div>
      <div><b>Customer:</b> {inv.customerName} {inv.customerPhone ? '| ' + inv.customerPhone : ''}</div>
      <table className="inv-table" style={{ marginTop: 12 }}>
        <tbody>
          <tr><th>Item</th><th>Metal</th><th>Purity</th><th>वजन(g)</th><th>Metal Value</th><th>Making</th><th>कुल</th></tr>
          {inv.items.map((it, idx) => (
            <tr key={idx}>
              <td>{it.name}</td><td>{it.metal}</td><td>{it.purity}%</td><td>{it.weight}</td>
              <td>{inr(it.metalVal)}</td><td>{inr(it.making)}</td><td>{inr(it.itemTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {inv.exchange && inv.exchange.value > 0 && (
        <p style={{ marginTop: 8, fontSize: 13 }}>
          पुराना सोना Exchange: {inv.exchange.weight}g @ {inv.exchange.purity}% (कटौती {inv.exchange.deduct}%) = {inr(inv.exchange.value)}
        </p>
      )}
      <div className="inv-totals">
        <div><span>Subtotal (Metal)</span><span>{inr(inv.subtotal)}</span></div>
        <div><span>Making Charges</span><span>{inr(inv.making)}</span></div>
        <div><span>Discount</span><span>- {inr(inv.discount)}</span></div>
        <div><span>{isNonGst ? 'GST (लागू नहीं)' : `GST (${inv.gstPct}%)`}</span><span>+ {inr(inv.gst)}</span></div>
        <div><span>Exchange Adjustment</span><span>- {inr(inv.exchange ? inv.exchange.value : 0)}</span></div>
        <div className="grand"><span>कुल राशि</span><span>{inr(inv.total)}</span></div>
        <div><span>प्राप्त (Paid)</span><span>{inr(inv.paid)}</span></div>
        <div><span>{inv.due >= 0 ? 'शेष (Due)' : 'एडवांस'}</span><span>{inr(Math.abs(inv.due))}</span></div>
      </div>
      <p style={{ marginTop: 20, fontSize: 12, color: '#777' }}>धन्यवाद! — {settings.shopNameHindi || settings.shopName}</p>
    </div>
  );
}
