import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { fmtDate, inr } from '../lib/format';
import { api } from '../lib/api';

function CustomerForm({ customer }) {
  const { mutate } = useData();
  const { closeModal } = useModal();
  const toast = useToast();
  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [balance, setBalance] = useState(customer?.balance || 0);

  async function save() {
    if (!name.trim()) { toast('नाम जरूरी है'); return; }
    const base = { name: name.trim(), phone: phone.trim(), address: address.trim() };
    try {
      // बकाया रकम सीधे नहीं लिखी जाती — वह हमेशा उधारी खाते से जुड़ती है
      await mutate(() => (customer
        ? api.updateCustomer(customer.id, base)
        : api.createCustomer({ ...base, openingBalance: Number(balance) || 0 })));
      toast('Customer Save हो गया ✔');
      closeModal();
    } catch (e) { toast(e.message); }
  }

  return (
    <div>
      <div className="modal-head"><h3>{customer ? 'Customer Edit करें' : 'नया Customer जोड़ें'}</h3><button className="modal-close" onClick={closeModal}>✕</button></div>
      <div className="field"><label>नाम *</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label>फ़ोन नंबर</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div className="field"><label>पता</label><input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
      <div className="field"><label>Opening उधारी बैलेंस (₹)</label><input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} /></div>
      <button className="btn btn-primary" onClick={save}>Save करें</button>
    </div>
  );
}

function LedgerModal({ customerId }) {
  const { db, mutate } = useData();
  const { closeModal } = useModal();
  const toast = useToast();
  const [amt, setAmt] = useState('');
  const c = db.customers.find((x) => x.id === customerId);
  if (!c) return null;
  const ledger = (c.ledger || []).slice().reverse();

  async function addPayment() {
    const n = Number(amt);
    if (!n) { toast('राशि डालें'); return; }
    try {
      // ऋणात्मक रकम = पैसा जमा हुआ
      await mutate(() => api.addLedger(customerId, { amount: -n, note: 'भुगतान प्राप्त' }));
    } catch (e) { toast(e.message); return; }
    toast('भुगतान दर्ज हो गया ✔');
    setAmt('');
  }

  return (
    <div>
      <div className="modal-head"><h3>{c.name} — उधारी हिसाब</h3><button className="modal-close" onClick={closeModal}>✕</button></div>
      <p>वर्तमान बैलेंस: <b style={{ color: c.balance > 0 ? 'var(--red)' : 'var(--green)' }}>{c.balance > 0 ? inr(c.balance) + ' बाकी' : c.balance < 0 ? inr(-c.balance) + ' एडवांस' : 'Clear'}</b></p>
      <div className="grid grid-2" style={{ margin: '14px 0' }}>
        <div>
          <div className="field"><label>राशि जमा करें (₹)</label><input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="जैसे 2000" /></div>
          <button className="btn btn-gold" onClick={addPayment}>भुगतान जमा करें</button>
        </div>
      </div>
      <div className="tbl-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
        <table>
          <tbody>
            <tr><th>तारीख</th><th>विवरण</th><th>राशि</th></tr>
            {ledger.length ? ledger.map((l, idx) => (
              <tr key={idx}><td>{fmtDate(l.date)}</td><td>{l.note}</td><td style={{ color: l.amount > 0 ? 'var(--red)' : 'var(--green)' }}>{l.amount > 0 ? '+' : ''}{inr(l.amount)}</td></tr>
            )) : <tr><td colSpan={3} className="empty">कोई लेन-देन नहीं</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Customers() {
  const { db } = useData();
  const { openModal } = useModal();

  return (
    <div className="card">
      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Customer List
        <button className="btn btn-gold" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => openModal(<CustomerForm />)}>+ नया Customer</button>
      </h3>
      <div className="tbl-wrap">
        <table>
          <tbody>
            <tr><th>नाम</th><th>फ़ोन</th><th>पता</th><th>उधारी बैलेंस</th><th></th></tr>
            {db.customers.length ? db.customers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td><td>{c.phone}</td><td>{c.address || '-'}</td>
                <td>{c.balance > 0 ? <span className="badge badge-due">{inr(c.balance)} बाकी</span> : c.balance < 0 ? <span className="badge badge-paid">{inr(-c.balance)} एडवांस</span> : <span className="badge badge-paid">Clear</span>}</td>
                <td className="row-actions">
                  <button className="icon-btn" onClick={() => openModal(<CustomerForm customer={c} />)}>Edit</button>
                  <button className="icon-btn" onClick={() => openModal(<LedgerModal customerId={c.id} />, true)}>हिसाब</button>
                </td>
              </tr>
            )) : <tr><td colSpan={5} className="empty">कोई Customer नहीं जोड़ा गया</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
