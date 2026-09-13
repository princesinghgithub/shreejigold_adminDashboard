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
    } catch (e) {
      // वही ग्राहक पहले से है — सर्वर रोकता है ताकि एक आदमी के दो खाते न बनें
      if (e.status === 409 && window.confirm(`${e.message}\n\nक्या यह सचमुच अलग आदमी है? तब नया खाता बना दें।`)) {
        try {
          await mutate(() => api.createCustomer({ ...base, openingBalance: Number(balance) || 0, allowDuplicate: true }));
          toast('नया खाता बन गया ✔');
          closeModal();
        } catch (e2) { toast(e2.message); }
        return;
      }
      toast(e.message);
    }
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

/** एक ही आदमी के दो खाते बन गए हों तो यहीं से मिलाकर एक कर दें */
function Duplicates() {
  const { mutate } = useData();
  const toast = useToast();
  const [groups, setGroups] = useState(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    try { setGroups(await api.customerDuplicates()); } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  async function merge(keep, drop) {
    if (!window.confirm(
      `"${drop.name}" वाला खाता "${keep.name}" में मिला दें?\n\n`
      + 'उसके सारे बिल और उधारी इसी खाते में आ जाएंगे, और दोहरा खाता हट जाएगा।',
    )) return;
    setBusy(true);
    try {
      await mutate(() => api.mergeCustomers(keep.id, drop.id));
      toast('दोनों खाते मिल गए ✔');
      setGroups(await api.customerDuplicates());
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="card">
      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        दोहरे खाते
        <button className="btn btn-outline" style={{ padding: '7px 14px', fontSize: 13 }} disabled={busy} onClick={check}>
          {busy ? 'देख रहे हैं…' : 'जाँचें'}
        </button>
      </h3>
      <p className="small-note" style={{ marginTop: 0 }}>
        एक ही नंबर या एक ही नाम से दो खाते बन गए हों तो यहाँ दिखेंगे। मिलाने पर सारे बिल और उधारी एक ही खाते में आ जाते हैं।
      </p>

      {groups === null ? null : groups.length === 0 ? (
        <div className="empty">कोई दोहरा खाता नहीं मिला ✔</div>
      ) : groups.map((g) => {
        const [keep, ...rest] = g.customers;
        return (
          <div className="dup-group" key={g.by + g.value}>
            <div>
              {g.by === 'phone' ? 'एक ही नंबर' : 'एक ही नाम'}: <b>{g.value}</b>
            </div>
            <div className="dup-keep">रहेगा: {keep.name}{keep.phone ? ` · ${keep.phone}` : ''} · {keep.balance > 0 ? `बाकी ${inr(keep.balance)}` : 'Clear'}</div>
            <div className="row-actions" style={{ flexWrap: 'wrap' }}>
              {rest.map((c) => (
                <button key={c.id} className="icon-btn" disabled={busy} onClick={() => merge(keep, c)}>
                  {c.name}{c.phone ? ` · ${c.phone}` : ''} {c.balance ? `(${inr(c.balance)})` : ''} — इसमें मिलाएं
                </button>
              ))}
            </div>
          </div>
        );
      })}
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
    <div>
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

      <Duplicates />
    </div>
  );
}
