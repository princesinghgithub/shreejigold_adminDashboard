import { useCallback, useEffect, useState } from 'react';
import { useModal } from '../context/ModalContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { fmtDate, inr } from '../lib/format';
import { billNoOf } from '../lib/bill';
import { goToBillingFor } from '../lib/nav';
import InvoiceModal from './InvoiceModal';

const tel = (phone) => 'tel:+91' + String(phone || '').replace(/\D/g, '').slice(-10);

/** दुकान से ग्राहक को WhatsApp — बकाया हो तो उसी का ज़िक्र (emoji नहीं, वरना टूटता है) */
function waHref(cust, settings) {
  const shop = settings.shopNameHindi || settings.shopName || 'Shreeji Gold';
  const due = Number(cust.balance) || 0;
  const text = due > 0
    ? `नमस्ते ${cust.name} जी, ${shop} से बात कर रहे हैं। आपका बकाया ₹${due.toFixed(0)} है।`
    : `नमस्ते ${cust.name} जी, ${shop} से बात कर रहे हैं।`;
  const phone = String(cust.phone || '').replace(/\D/g, '').slice(-10);
  return `https://api.whatsapp.com/send?phone=91${phone}&text=${encodeURIComponent(text)}`;
}

/** नाम-फ़ोन-पता-PAN यहीं सुधर जाएं — इसके लिए Customer List तक जाना न पड़े */
function EditRow({ cust, onSaved, onCancel }) {
  const toast = useToast();
  const [f, setF] = useState({ name: cust.name, phone: cust.phone || '', address: cust.address || '', pan: cust.pan || '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.name.trim()) { toast('नाम जरूरी है'); return; }
    if (saving) return;
    setSaving(true);
    try {
      await api.updateCustomer(cust.id, {
        name: f.name.trim(), phone: f.phone.trim(), address: f.address.trim(), pan: f.pan.trim().toUpperCase(),
      });
      toast('ग्राहक की जानकारी सेव हो गई ✔');
      onSaved();
    } catch (e) { toast(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="cust-edit">
      <div className="grid grid-2">
        <div className="field"><label>नाम *</label><input value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="field"><label>फ़ोन नंबर</label><input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>पता</label><input value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
        <div className="field"><label>PAN</label>
          <input value={f.pan} maxLength={10} placeholder="ABCDE1234F"
            onChange={(e) => set('pan', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /></div>
      </div>
      <div className="row-actions">
        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'सेव हो रहा है…' : 'Save करें'}</button>
        <button className="btn btn-ghost" onClick={onCancel}>रद्द करें</button>
      </div>
    </div>
  );
}

/**
 * ग्राहक का पूरा हिसाब एक ही जगह — बकाया, उसके सारे बिल, उधारी खाता, जमा करना,
 * जानकारी सुधारना और नया बिल. ऊपर के खोज खाने और Customer List, दोनों से यही खुलता है,
 * और इसके अंदर से खुला बिल "वापस" दबाकर यहीं लौट आता है.
 */
export default function CustomerModal({ customerId }) {
  const { db, refresh } = useData();
  const { openModal, closeModal } = useModal();
  const toast = useToast();
  const [cust, setCust] = useState(() => db.customers.find((x) => x.id === customerId) || null);
  const [bills, setBills] = useState(null);
  const [amt, setAmt] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const [c, list] = await Promise.all([api.getCustomer(customerId), api.customerBills(customerId)]);
      setCust(c);
      setBills(list);
      setErr('');
    } catch (e) { setErr(e.message); }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  async function addPayment() {
    const n = Number(amt);
    if (!(n > 0)) { toast('जमा की राशि डालें'); return; }
    if (saving) return;
    setSaving(true);
    try {
      // ऋणात्मक रकम = पैसा जमा हुआ
      await api.addLedger(customerId, { amount: -n, note: 'भुगतान प्राप्त' });
      setAmt('');
      toast(`${inr(n)} जमा हो गया ✔`);
      await load();
      refresh(); // डैशबोर्ड और उधारी की सूची भी ताज़ा
    } catch (e) { toast(e.message); } finally { setSaving(false); }
  }

  function reopenSelf() {
    openModal(<CustomerModal key={customerId} customerId={customerId} />, true);
  }

  async function openBill(id) {
    try {
      const inv = await api.getInvoice(id);
      openModal(
        <InvoiceModal
          key={inv.id}
          inv={inv}
          settings={db.settings}
          backTo={{ label: cust.name, onClick: reopenSelf }}
        />,
        true,
      );
    } catch (e) { toast(e.message); }
  }

  function newBill() {
    closeModal();
    goToBillingFor(customerId);
    toast(`${cust.name} के लिए नया बिल — नीचे Items भरें`);
  }

  if (!cust) {
    return (
      <div>
        <div className="modal-head"><h3>ग्राहक</h3><button className="modal-close" onClick={closeModal}>✕</button></div>
        <p className="empty">{err || 'लोड हो रहा है…'}</p>
      </div>
    );
  }

  const due = Number(cust.balance) || 0;
  const ledger = (cust.ledger || []).slice().reverse().slice(0, 12);
  const list = bills || [];
  const totalBought = list.reduce((s, b) => s + (Number(b.total) || 0), 0);

  return (
    <div>
      <div className="modal-head">
        <h3>{cust.name}</h3>
        <button className="modal-close" onClick={closeModal}>✕</button>
      </div>

      <div className={'pay-status ' + (due > 0 ? 'due' : 'clear')}>
        <span>
          {cust.phone ? <>{cust.phone} · </> : null}
          {cust.address ? <>{cust.address} · </> : null}
          {cust.pan ? <>PAN {cust.pan} · </> : null}
          <b>{due > 0 ? `बाकी ${inr(due)}` : due < 0 ? `एडवांस ${inr(-due)}` : 'हिसाब Clear'}</b>
        </span>
        {cust.phone && (
          <span className="row-actions">
            <a className="icon-btn" href={tel(cust.phone)}>📞 Call</a>
            <a className="icon-btn wa-btn" href={waHref(cust, db.settings)} target="_blank" rel="noreferrer">WhatsApp</a>
          </span>
        )}
      </div>

      <div className="row-actions" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-gold" style={{ padding: '7px 14px', fontSize: 13 }} onClick={newBill}>🧾 नया बिल</button>
        <button className="btn btn-outline" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => setEditing((v) => !v)}>
          {editing ? 'Edit बंद करें' : 'जानकारी Edit करें'}
        </button>
      </div>

      {editing && <EditRow cust={cust} onSaved={() => { setEditing(false); load(); refresh(); }} onCancel={() => setEditing(false)} />}

      <div className="cust-facts">
        <span>कुल बिल <b>{bills === null ? '…' : list.length}</b></span>
        <span>कुल खरीद <b>{bills === null ? '…' : inr(totalBought)}</b></span>
        <span>आख़िरी बिल <b>{list.length ? fmtDate(list[0].date) : '—'}</b></span>
      </div>

      <div className="pay-form">
        <input
          type="number"
          min="0"
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addPayment(); }}
          placeholder="उधारी में जमा राशि ₹"
        />
        <button className="btn btn-gold" disabled={saving} onClick={addPayment}>{saving ? 'जमा हो रहा है…' : 'जमा करें'}</button>
      </div>
      {err && <p className="err">{err}</p>}

      <h4 style={{ margin: '14px 0 6px' }}>इनके बिल</h4>
      <div className="tbl-wrap" style={{ maxHeight: 240, overflowY: 'auto' }}>
        <table>
          <tbody>
            <tr><th>बिल नं.</th><th>तारीख</th><th>कुल</th><th>बाकी</th><th></th></tr>
            {bills === null ? (
              <tr><td colSpan={5} className="empty">लोड हो रहा है…</td></tr>
            ) : list.length ? list.map((b) => (
              <tr key={b.id}>
                <td><b>{billNoOf(b)}</b></td>
                <td>{fmtDate(b.date)}</td>
                <td>{inr(b.total)}</td>
                <td>{b.due > 0 ? <span className="badge badge-due">{inr(b.due)}</span> : <span className="badge badge-paid">Clear</span>}</td>
                <td><button className="icon-btn" onClick={() => openBill(b.id)}>देखें</button></td>
              </tr>
            )) : <tr><td colSpan={5} className="empty">इनका कोई बिल नहीं</td></tr>}
          </tbody>
        </table>
      </div>

      <h4 style={{ margin: '14px 0 6px' }}>उधारी खाता</h4>
      <div className="tbl-wrap" style={{ maxHeight: 220, overflowY: 'auto' }}>
        <table>
          <tbody>
            <tr><th>तारीख</th><th>विवरण</th><th>राशि</th></tr>
            {ledger.length ? ledger.map((l, idx) => (
              <tr key={l.id || idx}>
                <td>{fmtDate(l.date)}</td>
                <td>{l.note}</td>
                <td style={{ color: l.amount > 0 ? 'var(--red)' : 'var(--green)' }}>{l.amount > 0 ? '+' : ''}{inr(l.amount)}</td>
              </tr>
            )) : <tr><td colSpan={3} className="empty">कोई लेन-देन नहीं</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
