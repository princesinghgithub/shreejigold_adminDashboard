import { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useModal } from '../context/ModalContext';
import { todayStr, inr } from '../lib/format';
import { api } from '../lib/api';
import { summarizeBill } from '../lib/calc';
import { PAYMENT_MODES, CASH_LIMIT, PAN_LIMIT } from '../lib/bill';
import { takePendingCustomer } from '../lib/nav';
import InvoiceModal from '../components/InvoiceModal';

const emptyItem = () => ({
  name: '', metal: 'Gold', huid: '', grossWeight: '', weight: '', purity: 100, makingType: 'flat', making: 0, hallmark: 0,
});
const MAKING_LABEL = { perg: 'Making (₹/g)', pct: 'Making (%)', flat: 'Making (₹)' };
const HUID_RX = /^[A-Z0-9]{6}$/;
const PAN_RX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export default function Billing() {
  const { db, mutate } = useData();
  const toast = useToast();
  const { openModal } = useModal();

  const [billType, setBillType] = useState('sale');
  const [gstMode, setGstMode] = useState('gst');
  // ग्राहक के खाते से "नया बिल" दबाकर आए हों तो वही ग्राहक पहले से चुना मिले
  const [custId, setCustId] = useState(() => takePendingCustomer() || '');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pan, setPan] = useState('');
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const [exWeight, setExWeight] = useState(0);
  const [exPurity, setExPurity] = useState(91.6);
  const [exDeduct, setExDeduct] = useState(2);
  const [exRate, setExRate] = useState(db.rates.gold || 0);

  const [discType, setDiscType] = useState('flat');
  const [discVal, setDiscVal] = useState(0);
  // GST दो में से किसी भी एक तरह से — दोनों खाने वैकल्पिक हैं
  const [gstPctVal, setGstPctVal] = useState(db.settings.gst); // प्रतिशत में
  const [gstAmtVal, setGstAmtVal] = useState('');              // सीधे रुपयों में
  const [pay, setPay] = useState({}); // { cash: '50000', upi: '20000' }
  const [matches, setMatches] = useState([]); // "यह ग्राहक पहले से है" वाले सुझाव

  // नया नाम/नंबर लिखते ही देख लें कि यह ग्राहक पहले से तो नहीं — वरना उसी आदमी के
  // दो खाते बन जाते हैं और उधारी दो जगह बँट जाती है
  useEffect(() => {
    const q = newPhone.trim().length >= 4 ? newPhone.trim() : newName.trim();
    if (custId || q.length < 3) { setMatches([]); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      api.search(q)
        .then((r) => { if (alive) setMatches(r.customers || []); })
        .catch(() => { /* न मिले तो कुछ न दिखाएं */ });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [newName, newPhone, custId]);

  // बिलिंग पेज पहले से खुला हो, तब भी ग्राहक चुना जाए
  useEffect(() => {
    function onGo(e) {
      if (e.detail && e.detail.view === 'billing' && e.detail.customerId) {
        takePendingCustomer();
        setCustId(e.detail.customerId);
        setNewName('');
        setNewPhone('');
      }
    }
    window.addEventListener('go-view', onGo);
    return () => window.removeEventListener('go-view', onGo);
  }, []);

  function updateItem(idx, patch) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItemRow() { setItems((prev) => [...prev, emptyItem()]); }
  function removeItemRow(idx) { setItems((prev) => prev.filter((_, i) => i !== idx)); }

  function onGstModeChange(v) {
    setGstMode(v);
    setGstAmtVal('');
    setGstPctVal(v === 'nongst' ? '' : db.settings.gst);
  }

  // एक खाना भरते ही दूसरा खाली — दोनों भरे होने पर "कौन सा लगेगा" की उलझन ही न रहे
  function onGstPct(v) {
    setGstPctVal(v);
    if (String(v).trim() !== '') setGstAmtVal('');
  }
  function onGstAmt(v) {
    setGstAmtVal(v);
    if (String(v).trim() !== '') setGstPctVal('');
  }

  const paidVal = PAYMENT_MODES.reduce((s, m) => s + (Number(pay[m.id]) || 0), 0);
  const cashVal = Number(pay.cash) || 0;
  const panUp = pan.trim().toUpperCase();
  const custPan = custId ? ((db.customers.find((c) => c.id === custId) || {}).pan || '') : '';
  const exchange = { weight: exWeight, purity: exPurity, deduct: exDeduct, rate: exRate };
  // रुपयों वाला खाना भरा हो तो वही, वरना प्रतिशत वाला; दोनों खाली = GST नहीं
  const gstFlat = String(gstAmtVal).trim() !== '';
  const gstInput = gstMode === 'nongst'
    ? { type: 'pct', value: 0 }
    : gstFlat ? { type: 'flat', value: gstAmtVal } : { type: 'pct', value: gstPctVal || 0 };
  const sums = summarizeBill(items, db.rates, exchange, discType, discVal, gstInput, paidVal);
  const cashWarn = billType === 'sale' && cashVal >= CASH_LIMIT;
  const panWarn = sums.total > PAN_LIMIT && !(panUp || custPan);

  async function finalizeBill() {
    const validItems = items.filter((it) => it.name && Number(it.weight) > 0);
    if (!validItems.length) { toast('कम से कम एक Item भरें'); return; }
    // 91.6 की जगह 916 जैसी गलती पर बिल 10 गुना बन जाता — पहले ही रोकें
    const badPurity = validItems.find((it) => !(Number(it.purity) > 0 && Number(it.purity) <= 100));
    if (badPurity) { toast(`"${badPurity.name}" की Purity 0 से 100% के बीच डालें (जैसे 22K = 91.6)`); return; }
    const badHuid = validItems.find((it) => it.huid && !HUID_RX.test(it.huid.trim().toUpperCase()));
    if (badHuid) { toast(`"${badHuid.name}" का HUID 6 अक्षर/अंक का होता है (जैसे VGXVXH)`); return; }
    const badGross = validItems.find((it) => Number(it.grossWeight) > 0 && Number(it.grossWeight) < Number(it.weight));
    if (badGross) { toast(`"${badGross.name}" का Gross वजन, Net वजन से कम नहीं हो सकता`); return; }
    if (validItems.some((it) => Number(it.hallmark) < 0)) { toast('Hallmark charge 0 से कम नहीं हो सकता'); return; }
    if (Number(exWeight) > 0 && !(Number(exPurity) > 0 && Number(exPurity) <= 100)) {
      toast('पुराने सोने की Purity 0 से 100% के बीच डालें'); return;
    }
    if (!(Number(exDeduct) >= 0 && Number(exDeduct) <= 100)) { toast('कटौती 0 से 100% के बीच डालें'); return; }
    if (panUp && !PAN_RX.test(panUp)) { toast('PAN नंबर गलत है (जैसे ABCDE1234F)'); return; }
    if (PAYMENT_MODES.some((m) => Number(pay[m.id]) < 0)) { toast('भुगतान की राशि 0 से कम नहीं हो सकती'); return; }
    // भाव 0 हो तो बिल ₹0 का बनता — पहले "आज का Rate" भरवाएं
    const noRate = validItems.find((it) => !(Number(it.metal === 'Silver' ? db.rates.silver : db.rates.gold) > 0));
    if (noRate) {
      toast(`पहले "आज का Rate" पेज पर ${noRate.metal === 'Silver' ? 'चांदी' : 'सोने'} का भाव डालें — बिना भाव के बिल ₹0 का बनता`);
      return;
    }
    if (panWarn && !window.confirm(`बिल ${inr(sums.total)} का है — ₹2 लाख से ऊपर के बिल पर ग्राहक का PAN (या Form 60) लेना ज़रूरी है।\n\nबिना PAN के बिल बनाएं?`)) return;
    if (cashWarn && !window.confirm(`नकद ${inr(cashVal)} — एक बिल पर ₹2 लाख या ज़्यादा नकद लेना कानूनन मना है (Income Tax धारा 269ST)। बाकी UPI / NEFT / Cheque से लें।\n\nफिर भी बिल बनाएं?`)) return;
    if (saving) return;
    setSaving(true);

    // हिसाब और बिल नंबर सर्वर खुद लगाता है (भाव भी वहीं से) — stock घटाना और
    // उधारी चढ़ाना भी वहीं होता है, इसलिए यहाँ दोहराते नहीं.
    const payments = PAYMENT_MODES
      .map((m) => ({ mode: m.id, amount: Number(pay[m.id]) || 0 }))
      .filter((p) => p.amount > 0);
    const payload = {
      type: billType,
      gstMode,
      date: date || todayStr(),
      items: validItems.map((it) => ({
        name: it.name.trim(),
        metal: it.metal,
        huid: (it.huid || '').trim().toUpperCase(),
        grossWeight: Number(it.grossWeight) || 0,
        weight: Number(it.weight) || 0,
        purity: Number(it.purity) || 0,
        makingType: it.makingType,
        making: Number(it.making) || 0,
        hallmark: Number(it.hallmark) || 0,
      })),
      exchange: {
        weight: Number(exWeight) || 0, purity: Number(exPurity) || 0,
        deduct: Number(exDeduct) || 0, rate: Number(exRate) || 0,
      },
      discountType: discType,
      discountValue: Number(discVal) || 0,
      gstType: gstInput.type,
      gstValue: Number(gstInput.value) || 0,
      paid: paidVal,
      payments,
      customerAddress: address.trim(),
      customerPan: panUp,
    };
    if (custId) payload.customerId = custId;
    else if (newName.trim()) {
      payload.customerName = newName.trim();
      payload.customerPhone = newPhone.trim();
    }

    try {
      const inv = await mutate(() => api.createInvoice(payload));
      toast(`बिल नं. ${inv.billNo || ''} तैयार हो गया ✔`);
      setItems([emptyItem()]);
      setExWeight(0); setDiscVal(0); setPay({});
      setCustId(''); setNewName(''); setNewPhone(''); setAddress(''); setPan('');
      openModal(<InvoiceModal inv={inv} settings={db.settings} />, true);
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="tabs">
        <button className={'tab' + (billType === 'sale' ? ' active' : '')} onClick={() => setBillType('sale')}>बिक्री (Sale)</button>
        <button className={'tab' + (billType === 'purchase' ? ' active' : '')} onClick={() => setBillType('purchase')}>खरीद (Purchase)</button>
      </div>

      <div className="card">
        <h3>Customer विवरण</h3>
        <div className="grid grid-2">
          <div className="field"><label>Customer चुनें</label>
            <select value={custId} onChange={(e) => setCustId(e.target.value)}>
              <option value="">-- नया / Walk-in Customer --</option>
              {db.customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
            </select>
          </div>
          <div className="field"><label>नया Customer नाम (अगर ऊपर नहीं चुना)</label><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="नाम" /></div>
        </div>
        <div className="grid grid-2">
          <div className="field"><label>फ़ोन नंबर</label><input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="10 अंक" /></div>
          <div className="field"><label>बिल की तारीख</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="grid grid-2">
          <div className="field"><label>पता (optional)</label><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="गाँव / मोहल्ला" /></div>
          <div className="field">
            <label>PAN {custPan ? `(record में: ${custPan})` : '(₹2 लाख से ऊपर के बिल पर ज़रूरी)'}</label>
            <input value={pan} maxLength={10} onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABCDE1234F" />
          </div>
        </div>

        {custId ? (
          <p className="small-note" style={{ margin: 0 }}>
            पुराना खाता चुना है — यह बिल और बकाया उसी खाते में जुड़ेगा, नया खाता नहीं बनेगा।
          </p>
        ) : matches.length > 0 ? (
          <div className="cust-matches">
            <span>ये ग्राहक पहले से हैं — नया खाता न बने, इसलिए इन्हीं में से चुनें:</span>
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                className="chip"
                onClick={() => { setCustId(m.id); setNewName(''); setNewPhone(''); setMatches([]); }}
              >
                {m.name}{m.phone ? ` · ${m.phone}` : ''}
                {m.balance > 0 ? ` · बाकी ${inr(m.balance)}` : ''}
                {m.bills ? ` · ${m.bills} बिल` : ''}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3>Items <span className="small-note" style={{ margin: 0 }}>— सोना, चांदी, जितने भी अलग-अलग Item हों, एक ही बिल में जोड़ सकते हैं</span></h3>
        <datalist id="purity-list">
          <option value="99.9">24K</option>
          <option value="91.6">22K</option>
          <option value="75">18K</option>
          <option value="58.5">14K</option>
          <option value="92.5">चांदी 925</option>
        </datalist>
        <div>
          {items.map((it, idx) => (
            <div className="item-row" key={idx}>
              <div className="field" style={{ margin: 0 }}><label>Item नाम</label><input value={it.name} onChange={(e) => updateItem(idx, { name: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>Metal</label>
                <select value={it.metal} onChange={(e) => updateItem(idx, { metal: e.target.value })}>
                  <option>Gold</option><option>Silver</option>
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}><label>HUID</label>
                <input value={it.huid} maxLength={6} placeholder="6 अक्षर"
                  onChange={(e) => updateItem(idx, { huid: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) })} />
              </div>
              <div className="field" style={{ margin: 0 }}><label>Gross Wt (g)</label><input type="number" value={it.grossWeight} placeholder="नग समेत" onChange={(e) => updateItem(idx, { grossWeight: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>Net Wt (g)</label><input type="number" value={it.weight} onChange={(e) => updateItem(idx, { weight: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>Purity %</label><input type="number" list="purity-list" value={it.purity} onChange={(e) => updateItem(idx, { purity: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>{MAKING_LABEL[it.makingType]}</label><input type="number" value={it.making} onChange={(e) => updateItem(idx, { making: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>Making Type</label>
                <select value={it.makingType} onChange={(e) => updateItem(idx, { makingType: e.target.value })}>
                  <option value="perg">₹/gram</option>
                  <option value="flat">Flat ₹</option>
                  <option value="pct">% of value</option>
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}><label>Hallmark ₹</label><input type="number" min="0" value={it.hallmark} onChange={(e) => updateItem(idx, { hallmark: e.target.value })} /></div>
              <button className="icon-btn" onClick={() => removeItemRow(idx)}>✕</button>
            </div>
          ))}
        </div>
        <button className="btn btn-outline" onClick={addItemRow}>+ Item जोड़ें</button>
      </div>

      <div className="card">
        <h3>पुराना सोना Exchange (वैकल्पिक)</h3>
        <div className="grid grid-4">
          <div className="field"><label>वजन (g)</label><input type="number" value={exWeight} onChange={(e) => setExWeight(e.target.value)} /></div>
          <div className="field"><label>Purity %</label><input type="number" list="purity-list" value={exPurity} onChange={(e) => setExPurity(e.target.value)} /></div>
          <div className="field"><label>कटौती % (wastage)</label><input type="number" value={exDeduct} onChange={(e) => setExDeduct(e.target.value)} /></div>
          <div className="field"><label>Rate (₹/g)</label><input type="number" value={exRate} onChange={(e) => setExRate(e.target.value)} /></div>
        </div>
      </div>

      <div className="card">
        <h3>बिल का प्रकार</h3>
        <div className="grid grid-2">
          <div className="field"><label>Bill Type चुनें</label>
            <select value={gstMode} onChange={(e) => onGstModeChange(e.target.value)}>
              <option value="gst">GST बिल (Tax Invoice)</option>
              <option value="nongst">बिना GST (Estimate / Non-GST)</option>
            </select>
          </div>
          <div className="field" style={{ alignSelf: 'end' }}>
            <p className="small-note" style={{ margin: 0 }}>बिना GST बिल में GST 0% रहेगा और Invoice पर "ESTIMATE (Non-GST)" लिखा आएगा। बिल नंबर अपने आप लगता है — GST बिल 1, 2, 3…; Estimate E-1…; खरीद P-1… (हर financial year में नए सिरे से)।</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Discount, GST और भुगतान</h3>
        <div className="grid grid-4">
          <div className="field"><label>Discount Type</label>
            <select value={discType} onChange={(e) => setDiscType(e.target.value)}>
              <option value="flat">₹ Flat</option><option value="pct">%</option>
            </select>
          </div>
          <div className="field"><label>Discount Value</label><input type="number" value={discVal} onChange={(e) => setDiscVal(e.target.value)} /></div>
          <div className="field"><label>GST % (वैकल्पिक)</label>
            <input type="number" min="0" placeholder="जैसे 3" value={gstPctVal}
              disabled={gstMode === 'nongst'} onChange={(e) => onGstPct(e.target.value)} /></div>
          <div className="field"><label>या GST राशि ₹ (वैकल्पिक)</label>
            <input type="number" min="0" placeholder="जैसे 1500" value={gstAmtVal}
              disabled={gstMode === 'nongst'} onChange={(e) => onGstAmt(e.target.value)} /></div>
        </div>
        <p className="small-note" style={{ marginTop: 0 }}>
          GST दो में से किसी भी एक तरह से जोड़ें — प्रतिशत, या सीधी रकम। एक भरते ही दूसरा अपने आप खाली हो जाता है,
          और बिल पर वही छपता है जो भरा गया। दोनों खाली रखें तो GST नहीं लगेगा।
        </p>

        <div className="pay-modes-title">अभी मिली राशि — किस तरीके से कितना</div>
        <div className="pay-modes">
          {PAYMENT_MODES.map((m) => (
            <div className="field" style={{ margin: 0 }} key={m.id}>
              <label>{m.label} ₹</label>
              <input type="number" min="0" placeholder="0" value={pay[m.id] ?? ''}
                onChange={(e) => setPay((p) => ({ ...p, [m.id]: e.target.value }))} />
            </div>
          ))}
        </div>
        {cashWarn && <div className="bill-warn">⚠ एक बिल पर ₹2 लाख या ज़्यादा नकद लेना कानूनन मना है (Income Tax धारा 269ST) — बाकी UPI / NEFT / Cheque से लें।</div>}
        {panWarn && <div className="bill-warn">⚠ बिल ₹2 लाख से ऊपर का है — ग्राहक का PAN (या Form 60) ऊपर भरें।</div>}

        <div>
          <div className="summary-line"><span>Metal Value</span><span>{inr(sums.subtotal)}</span></div>
          <div className="summary-line"><span>Making Charges</span><span>{inr(sums.makingTotal)}</span></div>
          {sums.hallmarkTotal > 0 && <div className="summary-line"><span>Hallmark Charges</span><span>{inr(sums.hallmarkTotal)}</span></div>}
          <div className="summary-line"><span>Discount</span><span>- {inr(sums.discount)}</span></div>
          <div className="summary-line">
            <span>GST {gstMode === 'nongst' ? '(लागू नहीं)' : gstFlat ? '(सीधी रकम)' : `(${sums.gstPct}%)`}</span>
            <span>+ {inr(sums.gstAmt)}</span>
          </div>
          <div className="summary-line"><span>पुराना सोना Exchange</span><span>- {inr(sums.exchangeVal)}</span></div>
          {Math.abs(sums.roundOff) >= 0.005 && (
            <div className="summary-line"><span>Round Off</span><span>{sums.roundOff > 0 ? '+ ' : '- '}{inr(Math.abs(sums.roundOff))}</span></div>
          )}
          <div className="summary-line"><b>कुल राशि (Bill Amount)</b><b>{inr(sums.total)}</b></div>
          <div className="summary-line"><span>प्राप्त राशि (Paid)</span><span>- {inr(sums.paid)}</span></div>
          <div className="summary-line total"><span>{sums.due >= 0 ? 'शेष देय (Due)' : 'एडवांस'}</span><span>{inr(Math.abs(sums.due))}</span></div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={saving} onClick={finalizeBill}>{saving ? 'बन रहा है…' : 'बिल Generate करें'}</button>
      </div>
    </div>
  );
}
