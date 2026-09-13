import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { inr } from '../lib/format';
import { api } from '../lib/api';
import CustomerModal from '../components/CustomerModal';

function CustomerForm({ customer }) {
  const { mutate } = useData();
  const { closeModal } = useModal();
  const toast = useToast();
  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [pan, setPan] = useState(customer?.pan || '');
  const [balance, setBalance] = useState(customer?.balance || 0);

  async function save() {
    if (!name.trim()) { toast('नाम जरूरी है'); return; }
    const base = { name: name.trim(), phone: phone.trim(), address: address.trim(), pan: pan.trim().toUpperCase() };
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
      <div className="field"><label>PAN (₹2 लाख से ऊपर के बिल पर ज़रूरी)</label>
        <input value={pan} maxLength={10} onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABCDE1234F" /></div>
      {!customer && <div className="field"><label>Opening उधारी बैलेंस (₹)</label><input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} /></div>}
      <button className="btn btn-primary" onClick={save}>Save करें</button>
    </div>
  );
}

export default function Customers() {
  const { db } = useData();
  const { openModal } = useModal();
  const [q, setQ] = useState('');

  const text = q.trim().toLowerCase();
  const list = text
    ? db.customers.filter((c) => [c.name, c.phone, c.address].some((v) => String(v || '').toLowerCase().includes(text)))
    : db.customers;

  return (
    <div className="card">
      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        Customer List
        <button className="btn btn-gold" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => openModal(<CustomerForm />)}>+ नया Customer</button>
      </h3>

      <div className="field" style={{ maxWidth: 340 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 नाम, फ़ोन या पते से खोजें" aria-label="Customer खोजें" />
      </div>

      <div className="tbl-wrap">
        <table>
          <tbody>
            <tr><th>नाम</th><th>फ़ोन</th><th>पता</th><th>उधारी बैलेंस</th><th></th></tr>
            {list.length ? list.map((c) => (
              <tr key={c.id}>
                <td><button className="link-btn" onClick={() => openModal(<CustomerModal key={c.id} customerId={c.id} />, true)}>{c.name}</button></td>
                <td>{c.phone}</td><td>{c.address || '-'}</td>
                <td>{c.balance > 0 ? <span className="badge badge-due">{inr(c.balance)} बाकी</span> : c.balance < 0 ? <span className="badge badge-paid">{inr(-c.balance)} एडवांस</span> : <span className="badge badge-paid">Clear</span>}</td>
                <td className="row-actions">
                  <button className="icon-btn" onClick={() => openModal(<CustomerForm customer={c} />)}>Edit</button>
                  <button className="icon-btn" onClick={() => openModal(<CustomerModal key={c.id} customerId={c.id} />, true)}>हिसाब / बिल</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="empty">
                {text ? `"${q.trim()}" से कोई Customer नहीं मिला` : 'कोई Customer नहीं जोड़ा गया'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
