import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { fmtDate, inr } from '../lib/format';
import { amountInWords } from '../lib/words';
import { useBillQr, useUpiQr } from '../lib/useBillQr';
import { billNoOf, fmtTime, karatLabel, paymentRows } from '../lib/bill';
import { LogoIcon } from './Logo';
import { DEFAULT_TERMS } from '../lib/billTerms';

// कम से कम इतनी लाइनें छपेंगी — छपा हुआ बिल खाली-खाली न लगे
const MIN_ROWS = 8;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const amt2 = (v) => num(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Make वाले कॉलम में क्या लिखा जाए. नए बिलों में डाली गई दर (makingRate) सेव होती है;
 * पुराने बिलों में सिर्फ निकली हुई रकम — तब दर वापस निकाल लेते हैं (11% / ₹350 प्रति ग्राम / सीधी रकम).
 */
function makingLabel(it) {
  const amt = num(it.making);
  const hasRate = it.makingRate !== undefined && it.makingRate !== null;
  if (it.makingType === 'pct') {
    if (hasRate) return num(it.makingRate) + '%';
    if (num(it.metalVal) > 0) return Math.round((amt / num(it.metalVal)) * 1000) / 10 + '%';
  }
  if (it.makingType === 'perg') {
    if (hasRate) return '₹' + num(it.makingRate).toLocaleString('en-IN') + '/g';
    if (num(it.weight) > 0) return '₹' + Math.round(amt / num(it.weight)).toLocaleString('en-IN') + '/g';
  }
  return inr(amt);
}

/** बिल पर छपने वाला per-gram भाव (purity समेत). पुराने बिलों में rate सेव नहीं — metalVal से निकालते हैं */
function effectiveRate(it) {
  if (num(it.rate) > 0) return num(it.rate);
  const w = num(it.weight);
  return w > 0 ? num(it.metalVal) / w : 0;
}

export default function InvoiceSlip({ inv, settings }) {
  const barcodeRef = useRef(null);
  const isNonGst = inv.gstMode === 'nongst';
  const isPurchase = inv.type === 'purchase';
  const barcode = inv.barcode || String(inv.id).replace(/\D/g, '').slice(-12).padStart(12, '0');
  const qr = useBillQr(settings, barcode);
  const upiQr = useUpiQr(settings);

  const title = isNonGst ? 'ESTIMATE' : isPurchase ? 'PURCHASE VOUCHER' : 'SALES VOUCHER';
  const subTitle = isNonGst ? 'Non-GST Estimate' : isPurchase ? 'Purchase' : 'Tax Invoice';

  const items = inv.items || [];
  const blanks = Math.max(0, MIN_ROWS - items.length);
  const hasHm = items.some((it) => num(it.hallmark) > 0);
  const colCount = hasHm ? 10 : 9;
  const exchangeVal = num(inv.exchange && inv.exchange.value);
  const hallmarkTotal = num(inv.hallmark) || items.reduce((s, it) => s + num(it.hallmark), 0);
  const halfGst = num(inv.gst) / 2;
  const halfPct = num(inv.gstPct) / 2;
  const taxable = num(inv.subtotal) + num(inv.making) + hallmarkTotal - num(inv.discount);
  const grossTotal = items.reduce((s, it) => s + num(it.grossWeight || it.weight), 0);
  const netTotal = items.reduce((s, it) => s + num(it.weight), 0);
  const roundOff = num(inv.roundOff);
  const pays = paymentRows(inv);
  const time = fmtTime(inv.createdAt);

  const categories = settings.categories || 'GOLD | DIAMOND | SILVER | GEMS | GOLD LOAN';
  const terms = settings.terms && settings.terms.length ? settings.terms : DEFAULT_TERMS;
  const hsn = settings.hsn || '7113';

  // barcode canvas पर, दोगुने resolution में बनाकर आधे आकार में दिखाते हैं — SVG वाला barcode
  // PDF में नहीं आता था, और canvas छपाई में भी साफ़ रहता है
  useEffect(() => {
    const el = barcodeRef.current;
    if (!el) return;
    try {
      JsBarcode(el, barcode, {
        format: 'CODE128', height: 60, width: 2.6, fontSize: 20, margin: 0, displayValue: true,
      });
      el.style.width = el.width / 2 + 'px';
    } catch { /* barcode न बने तो बिल फिर भी छपे */ }
  }, [barcode]);

  return (
    <div className="slip">
      {/* ── ऊपर की पट्टी: jurisdiction, voucher का नाम, फ़ोन ── */}
      <div className="slip-topbar">
        <div className="slip-juris">
          {settings.jurisdiction ? 'Subject to ' + settings.jurisdiction + ' Jurisdiction' : ''}
        </div>
        <div className="slip-vtitle">{title}</div>
        <div className="slip-tel">
          {settings.shopPhone ? <div>Tel. {settings.shopPhone}</div> : null}
          {settings.shopPhone2 ? <div>Cell {settings.shopPhone2}</div> : null}
        </div>
      </div>

      {/* ── दुकान का नाम + लोगो ── */}
      <div className="slip-brand">
        <div className="slip-logo"><LogoIcon src={settings.logoUrl} /></div>
        <div className="slip-name">
          {settings.blessing ? <div className="slip-blessing">{settings.blessing}</div> : null}
          <h1>{settings.shopNameHindi || settings.shopName}</h1>
          {settings.shopName && settings.shopNameHindi ? (
            <div className="slip-name-en">{settings.shopName}</div>
          ) : null}
          {settings.tagline ? <div className="slip-tagline">{settings.tagline}</div> : null}
          <div className="slip-addr">{settings.shopAddress}</div>
        </div>
        <div className="slip-suffix">
          {settings.nameSuffix ? <div className="slip-sons">{settings.nameSuffix}</div> : null}
          {settings.propName ? <div className="slip-prop">{settings.propName}</div> : null}
        </div>
      </div>

      {/* ── लाल पट्टी: क्या-क्या मिलता है ── */}
      <div className="slip-cats">{categories}</div>

      {/* ── बिल नंबर / तारीख-समय / ग्राहक ── */}
      <div className="slip-meta">
        <div className="slip-meta-row">
          <div><span className="lbl">Bill No.</span> <b>{billNoOf(inv)}</b></div>
          <div className="slip-meta-mid">{subTitle}</div>
          <div>
            <span className="lbl">Date :</span> <b>{fmtDate(inv.date)}</b>
            {time ? <>&nbsp; <span className="lbl">Time :</span> <b>{time}</b></> : null}
          </div>
        </div>
        <div className="slip-meta-row">
          <div><span className="lbl">Name :</span> <b>{inv.customerName || 'Walk-in Customer'}</b></div>
          <div>{settings.gstin ? <span className="slip-gstin">GSTIN — {settings.gstin}</span> : null}</div>
        </div>
        <div className="slip-meta-row">
          <div>
            {inv.customerAddress || ''}
            {inv.customerPan ? <>{inv.customerAddress ? <>&nbsp; </> : null}<span className="lbl">PAN :</span> <b>{inv.customerPan}</b></> : null}
          </div>
          <div>{inv.customerPhone ? <span><span className="lbl">Mob :</span> {inv.customerPhone}</span> : null}</div>
        </div>
      </div>

      {/* ── आइटम की टेबल — जितने आइटम जोड़े, सब यहाँ ── */}
      <table className="slip-table">
        <thead>
          <tr>
            <th className="c-sn">#</th>
            <th className="c-item">Item</th>
            <th className="c-huid">HUID</th>
            <th className="c-hsn">HSN</th>
            <th className="c-num">Gross Wt</th>
            <th className="c-num">Net Wt</th>
            <th className="c-num">Rate</th>
            <th className="c-num">Make</th>
            {hasHm && <th className="c-num">Hallmark</th>}
            <th className="c-num c-amt">Rs</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td className="c-sn">{idx + 1}</td>
              <td className="c-item">
                <span className="it-name">{it.name}</span>
                <span className="it-sub">
                  {settings.hallmarkLabel || 'Hallmark'} {num(it.purity)} · {it.metal}
                </span>
              </td>
              <td className="c-huid">{it.huid || '—'}</td>
              <td className="c-hsn">{hsn}</td>
              <td className="c-num">{num(it.grossWeight || it.weight).toFixed(3)}</td>
              <td className="c-num">{num(it.weight).toFixed(3)}</td>
              <td className="c-num">
                {effectiveRate(it).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                <span className="it-sub">{karatLabel(it.metal, it.purity)}</span>
              </td>
              <td className="c-num">{makingLabel(it)}</td>
              {hasHm && <td className="c-num">{num(it.hallmark) > 0 ? amt2(it.hallmark) : '—'}</td>}
              <td className="c-num c-amt">{amt2(it.itemTotal)}</td>
            </tr>
          ))}
          {Array.from({ length: blanks }).map((_, i) => (
            <tr key={'b' + i} className="slip-blank">
              {Array.from({ length: colCount }).map((__, j) => (
                <td key={j} className={j === 0 ? 'c-sn' : undefined}>{j === 0 ? ' ' : null}</td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="c-item"><b>कुल {items.length} आइटम</b></td>
            <td className="c-num"><b>{grossTotal.toFixed(3)}</b></td>
            <td className="c-num"><b>{netTotal.toFixed(3)}</b></td>
            <td /><td />
            {hasHm && <td className="c-num"><b>{amt2(hallmarkTotal)}</b></td>}
            <td className="c-num c-amt"><b>{amt2(num(inv.subtotal) + num(inv.making) + hallmarkTotal)}</b></td>
          </tr>
        </tfoot>
      </table>

      {/* ── नीचे: भुगतान, शब्दों में रकम (बाएँ) और जोड़ (दाएँ) ── */}
      <div className="slip-bottom">
        <div className="slip-left">
          {exchangeVal > 0 && (
            <div className="slip-exch">
              <b>पुराना सोना / Exchange</b>
              <div>
                {num(inv.exchange.weight).toFixed(3)} g @ {num(inv.exchange.purity)}% ·
                कटौती {num(inv.exchange.deduct)}% = <b>{inr(exchangeVal)}</b>
              </div>
            </div>
          )}
          {pays.length > 0 && (
            <div className="slip-pay">
              <div className="slip-pay-head">भुगतान का तरीका / Mode of Payment</div>
              {pays.map((p) => (
                <div key={p.label}><span>{p.label}</span><span>{inr(p.amount)}</span></div>
              ))}
            </div>
          )}
          <div className="slip-words">
            <span className="lbl">Amount in Words :</span>
            <b>{amountInWords(inv.total)}</b>
          </div>
          <div className="slip-codes">
            <canvas ref={barcodeRef} className="slip-barcode" />
            {qr ? (
              <div className="slip-qr">
                <img src={qr} alt="बिल जाँचें" />
                <span>मोबाइल से स्कैन<br />करके बिल जाँचें</span>
              </div>
            ) : null}
            {upiQr ? (
              <div className="slip-upi">
                <img src={upiQr} alt="UPI से भुगतान" />
                <span>
                  <b>UPI से भुगतान</b><br />
                  किसी भी UPI ऐप से<br />स्कैन करें<br />
                  <span className="upi-id">{settings.upiId}</span>
                </span>
              </div>
            ) : null}
            <div className="slip-hallmark">
              <div className="hm-tri">▲</div>
              <div className="hm-txt">B.I.S.<br />HALLMARK</div>
            </div>
          </div>
        </div>

        <div className="slip-right">
          <div className="slip-sum">
            <div><span>धातु मूल्य / Metal Value</span><span>{inr(inv.subtotal)}</span></div>
            <div><span>मजदूरी / Making</span><span>{inr(inv.making)}</span></div>
            {hallmarkTotal > 0 && <div><span>हॉलमार्क / Hallmark</span><span>{inr(hallmarkTotal)}</span></div>}
            <div><span>छूट / Discount</span><span>− {inr(inv.discount)}</span></div>
            <div className="sep"><span>Taxable Value</span><span>{inr(taxable)}</span></div>
            {isNonGst ? (
              <div className="muted"><span>GST</span><span>लागू नहीं</span></div>
            ) : (
              <>
                <div><span>CGST @ {halfPct}%</span><span>+ {inr(halfGst)}</span></div>
                <div><span>SGST @ {halfPct}%</span><span>+ {inr(halfGst)}</span></div>
              </>
            )}
            {exchangeVal > 0 && (
              <div><span>Exchange समायोजन</span><span>− {inr(exchangeVal)}</span></div>
            )}
            {Math.abs(roundOff) >= 0.005 && (
              <div><span>Round Off</span><span>{roundOff > 0 ? '+ ' : '− '}{inr(Math.abs(roundOff))}</span></div>
            )}
            <div className="grand"><span>कुल राशि</span><span>{inr(inv.total)}</span></div>
            <div><span>प्राप्त / Paid</span><span>{inr(inv.paid)}</span></div>
            <div className={num(inv.due) > 0 ? 'due' : 'clear'}>
              <span>{num(inv.due) >= 0 ? 'शेष / Balance Due' : 'एडवांस / Advance'}</span>
              <span>{inr(Math.abs(num(inv.due)))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── शर्तें ── */}
      <div className="slip-terms">
        <div className="slip-terms-head">NOTE FOR CUSTOMER — ग्राहक कृपया ध्यान दें</div>
        <ol>{terms.map((t, i) => <li key={i}>{t}</li>)}</ol>
      </div>

      {/* ── हस्ताक्षर ── */}
      <div className="slip-sign">
        <div>
          <div className="sign-line" />
          <div>ग्राहक के हस्ताक्षर / Customer Sig.</div>
        </div>
        <div className="slip-guarantee">{settings.footerNote || 'जेवर टूटने की कोई भी गारंटी नहीं होगी।'}</div>
        <div style={{ textAlign: 'right' }}>
          <div className="sign-line" />
          <div>For — {settings.shopNameHindi || settings.shopName}</div>
        </div>
      </div>
    </div>
  );
}
