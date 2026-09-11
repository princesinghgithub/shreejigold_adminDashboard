import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { fmtDate, inr } from '../lib/format';
import { amountInWords } from '../lib/words';
import { useBillQr, useUpiQr } from '../lib/useBillQr';
import { billNoOf, fmtTime, karatLabel, paymentRows } from '../lib/bill';
import { LogoWordmark } from './Logo';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function InvoiceView({ inv, settings }) {
  const barcodeRef = useRef(null);
  const isNonGst = inv.gstMode === 'nongst';
  const label = isNonGst ? 'ESTIMATE (Non-GST)' : (inv.type === 'sale' ? 'TAX INVOICE (Sale)' : 'PURCHASE VOUCHER');
  const barcode = inv.barcode || inv.id.replace(/\D/g, '').slice(-12).padStart(12, '0');
  const qr = useBillQr(settings, barcode);
  const upiQr = useUpiQr(settings);

  const items = inv.items || [];
  const hallmarkTotal = num(inv.hallmark) || items.reduce((s, it) => s + num(it.hallmark), 0);
  const roundOff = num(inv.roundOff);
  const pays = paymentRows(inv);
  const time = fmtTime(inv.createdAt);
  const halfPct = num(inv.gstPct) / 2;
  const halfGst = num(inv.gst) / 2;

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
          {settings.gstin && <div><b>GSTIN:</b> {settings.gstin}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><b>{label}</b></div>
          <div>Invoice No: <b>{billNoOf(inv)}</b></div>
          <div>तारीख: {fmtDate(inv.date)}{time ? ` · ${time}` : ''}</div>
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
      {(inv.customerAddress || inv.customerPan) && (
        <div style={{ fontSize: 13 }}>
          {inv.customerAddress}
          {inv.customerAddress && inv.customerPan ? ' | ' : ''}
          {inv.customerPan ? <><b>PAN:</b> {inv.customerPan}</> : null}
        </div>
      )}
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table className="inv-table">
          <tbody>
            <tr>
              <th>Item</th><th>HUID</th><th>Purity</th><th>Gross Wt</th><th>Net Wt</th><th>Rate/g</th>
              <th>Metal Value</th><th>Making</th>{hallmarkTotal > 0 && <th>Hallmark</th>}<th>कुल</th>
            </tr>
            {items.map((it, idx) => (
              <tr key={idx}>
                <td>{it.name}</td>
                <td>{it.huid || '—'}</td>
                <td>{karatLabel(it.metal, it.purity)} ({num(it.purity)}%)</td>
                <td>{num(it.grossWeight || it.weight).toFixed(3)}</td>
                <td>{num(it.weight).toFixed(3)}</td>
                <td>{inr(num(it.rate) || (num(it.weight) ? num(it.metalVal) / num(it.weight) : 0))}</td>
                <td>{inr(it.metalVal)}</td>
                <td>{inr(it.making)}</td>
                {hallmarkTotal > 0 && <td>{inr(it.hallmark)}</td>}
                <td>{inr(it.itemTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {inv.exchange && inv.exchange.value > 0 && (
        <p style={{ marginTop: 8, fontSize: 13 }}>
          पुराना सोना Exchange: {inv.exchange.weight}g @ {inv.exchange.purity}% (कटौती {inv.exchange.deduct}%) = {inr(inv.exchange.value)}
        </p>
      )}
      <div className="inv-totals">
        <div><span>Subtotal (Metal)</span><span>{inr(inv.subtotal)}</span></div>
        <div><span>Making Charges</span><span>{inr(inv.making)}</span></div>
        {hallmarkTotal > 0 && <div><span>Hallmark Charges</span><span>{inr(hallmarkTotal)}</span></div>}
        <div><span>Discount</span><span>- {inr(inv.discount)}</span></div>
        {isNonGst ? (
          <div><span>GST (लागू नहीं)</span><span>+ {inr(0)}</span></div>
        ) : (
          <>
            <div><span>CGST ({halfPct}%)</span><span>+ {inr(halfGst)}</span></div>
            <div><span>SGST ({halfPct}%)</span><span>+ {inr(halfGst)}</span></div>
          </>
        )}
        <div><span>Exchange Adjustment</span><span>- {inr(inv.exchange ? inv.exchange.value : 0)}</span></div>
        {Math.abs(roundOff) >= 0.005 && (
          <div><span>Round Off</span><span>{roundOff > 0 ? '+ ' : '- '}{inr(Math.abs(roundOff))}</span></div>
        )}
        <div className="grand"><span>कुल राशि</span><span>{inr(inv.total)}</span></div>
        <div><span>प्राप्त (Paid)</span><span>{inr(inv.paid)}</span></div>
        {pays.length > 1 || (pays.length === 1 && pays[0].label !== 'प्राप्त')
          ? pays.map((p) => (
            <div key={p.label} style={{ fontSize: 12, color: '#6b5a48' }}><span>&nbsp;&nbsp;{p.label}</span><span>{inr(p.amount)}</span></div>
          ))
          : null}
        <div><span>{inv.due >= 0 ? 'शेष (Due)' : 'एडवांस'}</span><span>{inr(Math.abs(inv.due))}</span></div>
      </div>
      <p style={{ marginTop: 10, fontSize: 13 }}><b>Amount in Words:</b> {amountInWords(inv.total)}</p>
      {upiQr && (
        <div className="inv-upi">
          <img src={upiQr} alt="UPI से भुगतान" />
          <span><b>UPI से भुगतान करें</b><br />किसी भी UPI ऐप से स्कैन करें<br />{settings.upiId}</span>
        </div>
      )}
      <p style={{ marginTop: 20, fontSize: 12, color: '#777' }}>धन्यवाद! — {settings.shopNameHindi || settings.shopName}</p>
    </div>
  );
}
