import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useModal } from '../context/ModalContext';
import { todayStr, inr } from '../lib/format';
import { api } from '../lib/api';
import { summarizeBill } from '../lib/calc';
import InvoiceModal from '../components/InvoiceModal';

const emptyItem = () => ({ name: '', metal: 'Gold', weight: '', purity: 100, makingType: 'flat', making: 0 });

export default function Billing() {
  const { db, mutate } = useData();
  const toast = useToast();
  const { openModal } = useModal();

  const [billType, setBillType] = useState('sale');
  const [gstMode, setGstMode] = useState('gst');
  const [custId, setCustId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const [exWeight, setExWeight] = useState(0);
  const [exPurity, setExPurity] = useState(91.6);
  const [exDeduct, setExDeduct] = useState(2);
  const [exRate, setExRate] = useState(db.rates.gold || 0);

  const [discType, setDiscType] = useState('flat');
  const [discVal, setDiscVal] = useState(0);
  const [gstVal, setGstVal] = useState(db.settings.gst);
  const [paidVal, setPaidVal] = useState(0);

  function updateItem(idx, patch) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItemRow() { setItems((prev) => [...prev, emptyItem()]); }
  function removeItemRow(idx) { setItems((prev) => prev.filter((_, i) => i !== idx)); }

  function onGstModeChange(v) {
    setGstMode(v);
    if (v === 'nongst') setGstVal(0);
    else setGstVal(db.settings.gst);
  }

  const exchange = { weight: exWeight, purity: exPurity, deduct: exDeduct, rate: exRate };
  const sums = summarizeBill(items, db.rates, exchange, discType, discVal, gstVal, paidVal);

  async function finalizeBill() {
    const validItems = items.filter((it) => it.name && Number(it.weight) > 0);
    if (!validItems.length) { toast('कम से कम एक Item भरें'); return; }
    // 91.6 की जगह 916 जैसी गलती पर बिल 10 गुना बन जाता — पहले ही रोकें
    const badPurity = validItems.find((it) => !(Number(it.purity) > 0 && Number(it.purity) <= 100));
    if (badPurity) { toast(`"${badPurity.name}" की Purity 0 से 100% के बीच डालें (जैसे 22K = 91.6)`); return; }
    if (Number(exWeight) > 0 && !(Number(exPurity) > 0 && Number(exPurity) <= 100)) {
      toast('पुराने सोने की Purity 0 से 100% के बीच डालें'); return;
    }
    if (!(Number(exDeduct) >= 0 && Number(exDeduct) <= 100)) { toast('कटौती 0 से 100% के बीच डालें'); return; }
    // भाव 0 हो तो बिल ₹0 का बनता — पहले "आज का Rate" भरवाएं
    const noRate = validItems.find((it) => !(Number(it.metal === 'Silver' ? db.rates.silver : db.rates.gold) > 0));
    if (noRate) {
      toast(`पहले "आज का Rate" पेज पर ${noRate.metal === 'Silver' ? 'चांदी' : 'सोने'} का भाव डालें — बिना भाव के बिल ₹0 का बनता`);
      return;
    }
    if (saving) return;
    setSaving(true);

    // हिसाब सर्वर खुद लगाता है (भाव भी वहीं से) — stock घटाना और
    // उधारी चढ़ाना भी वहीं होता है, इसलिए यहाँ दोहराते नहीं.
    const payload = {
      type: billType,
      gstMode,
      date: date || todayStr(),
      items: validItems.map((it) => ({
        name: it.name.trim(),
        metal: it.metal,
        weight: Number(it.weight) || 0,
        purity: Number(it.purity) || 0,
        makingType: it.makingType,
        making: Number(it.making) || 0,
      })),
      exchange: {
        weight: Number(exWeight) || 0, purity: Number(exPurity) || 0,
        deduct: Number(exDeduct) || 0, rate: Number(exRate) || 0,
      },
      discountType: discType,
      discountValue: Number(discVal) || 0,
      gstPct: Number(gstVal) || 0,
      paid: Number(paidVal) || 0,
    };
    if (custId) payload.customerId = custId;
    else if (newName.trim()) {
      payload.customerName = newName.trim();
      payload.customerPhone = newPhone.trim();
    }

    try {
      const inv = await mutate(() => api.createInvoice(payload));
      toast('बिल तैयार हो गया ✔');
      setItems([emptyItem()]);
      setExWeight(0); setDiscVal(0); setPaidVal(0);
      setCustId(''); setNewName(''); setNewPhone('');
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
      </div>

      <div className="card">
        <h3>Items <span className="small-note" style={{ margin: 0 }}>— सोना, चांदी, जितने भी अलग-अलग Item हों, एक ही बिल में जोड़ सकते हैं</span></h3>
        <div>
          {items.map((it, idx) => (
            <div className="item-row" key={idx}>
              <div className="field" style={{ margin: 0 }}><label>Item नाम</label><input value={it.name} onChange={(e) => updateItem(idx, { name: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>Metal</label>
                <select value={it.metal} onChange={(e) => updateItem(idx, { metal: e.target.value })}>
                  <option>Gold</option><option>Silver</option>
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}><label>वजन (g)</label><input type="number" value={it.weight} onChange={(e) => updateItem(idx, { weight: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>Purity %</label><input type="number" value={it.purity} onChange={(e) => updateItem(idx, { purity: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>Making (₹/g)</label><input type="number" value={it.making} onChange={(e) => updateItem(idx, { making: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>Making Type</label>
                <select value={it.makingType} onChange={(e) => updateItem(idx, { makingType: e.target.value })}>
                  <option value="perg">₹/gram</option>
                  <option value="flat">Flat ₹</option>
                  <option value="pct">% of value</option>
                </select>
              </div>
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
          <div className="field"><label>Purity %</label><input type="number" value={exPurity} onChange={(e) => setExPurity(e.target.value)} /></div>
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
            <p className="small-note" style={{ margin: 0 }}>बिना GST बिल में GST 0% रहेगा और Invoice पर "ESTIMATE (Non-GST)" लिखा आएगा।</p>
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
          <div className="field"><label>GST %</label><input type="number" value={gstVal} disabled={gstMode === 'nongst'} onChange={(e) => setGstVal(e.target.value)} /></div>
          <div className="field"><label>अभी मिली राशि (Paid ₹)</label><input type="number" value={paidVal} onChange={(e) => setPaidVal(e.target.value)} /></div>
        </div>
        <div>
          <div className="summary-line"><span>Metal Value</span><span>{inr(sums.subtotal)}</span></div>
          <div className="summary-line"><span>Making Charges</span><span>{inr(sums.makingTotal)}</span></div>
          <div className="summary-line"><span>Discount</span><span>- {inr(sums.discount)}</span></div>
          <div className="summary-line"><span>GST ({sums.gstPct}%)</span><span>+ {inr(sums.gstAmt)}</span></div>
          <div className="summary-line"><span>पुराना सोना Exchange</span><span>- {inr(sums.exchangeVal)}</span></div>
          <div className="summary-line"><span>प्राप्त राशि (Paid)</span><span>- {inr(sums.paid)}</span></div>
          <div className="summary-line total"><span>{sums.due >= 0 ? 'शेष देय (Due)' : 'एडवांस'}</span><span>{inr(Math.abs(sums.due))}</span></div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={saving} onClick={finalizeBill}>{saving ? 'बन रहा है…' : 'बिल Generate करें'}</button>
      </div>
    </div>
  );
}
