import { useState } from 'react';
import InvoiceView from './InvoiceView';
import InvoiceSlip from './InvoiceSlip';
import { usePrint } from '../context/PrintContext';
import { useModal } from '../context/ModalContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { fmtDate, inr } from '../lib/format';
import { billNoOf, paymentRows, PAYMENT_MODES, CASH_LIMIT } from '../lib/bill';

export default function InvoiceModal({ inv: initialInv, settings }) {
  const { requestPrint, requestPdf } = usePrint();
  const { closeModal } = useModal();
  const { refresh } = useData();
  const toast = useToast();
  const [inv, setInv] = useState(initialInv); // भुगतान के बाद नया paid / due यहीं आता है
  const [tpl, setTpl] = useState(settings.billTemplate || 'slip');
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const isRealBill = inv.id !== 'inv_preview'; // Rates पेज का नमूना बिल — उस पर भुगतान नहीं

  function shareWhatsapp() {
    const label = inv.gstMode === 'nongst' ? 'Estimate (Non-GST)' : (inv.type === 'sale' ? 'बिक्री बिल' : 'खरीद बिल');
    const shop = settings.shopNameHindi || settings.shopName;
    const pays = paymentRows(inv);
    const lines = [
      `*${shop}*`,
      `${label} #${billNoOf(inv)}`,
      `तारीख: ${fmtDate(inv.date)}`,
      // GST बिल पर दुकान का GSTIN (Estimate / Non-GST पर नहीं)
      inv.gstMode !== 'nongst' && settings.gstin ? `GSTIN: ${settings.gstin}` : '',
      `Customer: ${inv.customerName}`,
      '---',
      ...inv.items.map((it) => `${it.name}${it.huid ? ` (HUID ${it.huid})` : ''} - ${it.weight}g (${it.purity}%) = ₹${Number(it.itemTotal || 0).toFixed(0)}`),
      '---',
      `कुल राशि: ₹${Number(inv.total || 0).toFixed(0)}`,
      Number(inv.paid) > 0 ? `प्राप्त: ₹${Number(inv.paid).toFixed(0)}${pays.length ? ` (${pays.map((p) => `${p.label} ₹${Number(p.amount).toFixed(0)}`).join(', ')})` : ''}` : '',
      `${inv.due >= 0 ? 'शेष देय' : 'एडवांस'}: ₹${Math.abs(Number(inv.due || 0)).toFixed(0)}`,
      'धन्यवाद!',
      [settings.propName, settings.shopPhone].filter(Boolean).join(' — '),
    ].filter(Boolean);
    // पूरा संदेश encode — वरना "#" आते ही बाकी संदेश (items, कुल, बकाया) कट जाता था.
    // wa.me का redirect कुछ अक्षर बिगाड़ देता है, इसलिए सीधा api.whatsapp.com
    const text = encodeURIComponent(lines.join('\n'));
    const phone = (inv.customerPhone || '').replace(/\D/g, '').slice(-10);
    const waUrl = phone
      ? `https://api.whatsapp.com/send?phone=91${phone}&text=${text}`
      : `https://api.whatsapp.com/send?text=${text}`;
    window.open(waUrl, '_blank');
  }

  async function savePayment() {
    if (saving) return;
    const amt = Number(amount);
    if (!(amt > 0)) { toast('जमा की राशि डालें'); return; }
    if (amt > Number(inv.due) + 0.001
      && !window.confirm(`बाकी सिर्फ ${inr(inv.due)} है। ${inr(amt)} जमा करने पर ${inr(amt - inv.due)} एडवांस रहेगा। जारी रखें?`)) return;
    if (inv.type === 'sale' && mode === 'cash') {
      const cashSoFar = (inv.payments || []).filter((p) => p.mode === 'cash').reduce((s, p) => s + (Number(p.amount) || 0), 0);
      if (cashSoFar + amt >= CASH_LIMIT
        && !window.confirm(`इस बिल पर कुल नकद ${inr(cashSoFar + amt)} हो जाएगा। ₹2 लाख या ज़्यादा नकद लेना कानूनन मना है (Income Tax धारा 269ST) — बाकी UPI / NEFT / Cheque से लें।\n\nफिर भी नकद दर्ज करें?`)) return;
    }

    setSaving(true);
    try {
      const updated = await api.recordPayment(inv.id, amt, note.trim() || undefined, mode);
      setInv(updated);
      setPayOpen(false);
      setAmount('');
      setNote('');
      toast(`${inr(amt)} जमा हो गया ✔`);
      refresh(); // डैशबोर्ड, उधारी खाता और रिपोर्ट भी ताज़ा
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  const due = Number(inv.due) || 0;

  return (
    <div>
      <div className="modal-head">
        <h3>बिल नं. {billNoOf(inv)}</h3>
        <button className="modal-close" onClick={closeModal}>✕</button>
      </div>

      {isRealBill && (
        <div className={'pay-status ' + (due > 0 ? 'due' : 'clear')}>
          <span>
            कुल {inr(inv.total)} · मिले {inr(inv.paid)} ·{' '}
            <b>{due > 0 ? `बाकी ${inr(due)}` : due < 0 ? `एडवांस ${inr(-due)}` : 'पूरा भुगतान ✔'}</b>
          </span>
          {due > 0 && !payOpen && (
            <button className="btn btn-gold" onClick={() => setPayOpen(true)}>💰 भुगतान दर्ज करें</button>
          )}
        </div>
      )}

      {payOpen && (
        <div className="pay-form">
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') savePayment(); }}
            placeholder={`राशि ₹ (बाकी ${inr(due)})`}
            autoFocus
          />
          <select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="भुगतान का तरीका">
            {PAYMENT_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="नोट (optional) — जैसे UPI ref. / Cheque नं." />
          <button className="btn btn-primary" disabled={saving} onClick={savePayment}>{saving ? 'जमा हो रहा है…' : 'जमा करें'}</button>
          <button className="btn btn-ghost" onClick={() => setPayOpen(false)}>रद्द करें</button>
        </div>
      )}

      <div className="tpl-switch">
        <button className={tpl === 'slip' ? 'on' : ''} onClick={() => setTpl('slip')}>प्रीमियम स्लिप</button>
        <button className={tpl === 'simple' ? 'on' : ''} onClick={() => setTpl('simple')}>सादा बिल</button>
      </div>

      <div className={tpl === 'slip' ? '' : 'inv-preview-box'}>
        {tpl === 'slip'
          ? <InvoiceSlip inv={inv} settings={settings} />
          : <InvoiceView inv={inv} settings={settings} />}
      </div>

      <div className="row-actions" style={{ marginTop: 16 }}>
        <button className="btn btn-outline" onClick={() => requestPrint(inv, settings, tpl)}>🖨 Print</button>
        <button className="btn btn-outline" onClick={() => requestPdf(inv, settings, tpl)}>⬇ PDF Download</button>
        <button className="btn btn-gold" onClick={shareWhatsapp}>WhatsApp पर भेजें</button>
      </div>
    </div>
  );
}
