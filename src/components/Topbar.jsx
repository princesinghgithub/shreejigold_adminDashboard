import { useEffect, useState } from 'react';
import { LogoIcon } from './Logo';
import { fmtDate, inr } from '../lib/format';
import { useData } from '../context/DataContext';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import InvoiceModal from './InvoiceModal';

const TITLES = {
  dashboard: 'डैशबोर्ड', rates: 'आज का Rate', billing: 'बिलिंग', exchange: 'पुराना सोना Exchange',
  customers: 'Customer / उधारी', stock: 'Stock Management', reports: 'Sales Reports', offers: 'Offers', backup: 'Data Backup',
  catalog: 'Website Catalog', leads: 'Website Leads', users: 'Users / Staff',
};

/**
 * बिल का barcode / QR स्कैन करें, या बिल नंबर / ग्राहक का नाम लिखें — बिल तुरंत खुलता है.
 * Scanner कीबोर्ड की तरह अंक लिखकर Enter दबाता है: इस खाने में cursor हो तो सीधा, और
 * किसी खाने में न हो तब भी पकड़ लिया जाता है.
 */
function BillScan() {
  const { db } = useData();
  const { openModal } = useModal();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  async function find(raw) {
    const text = String(raw || '').trim();
    if (!text || busy) return;
    // QR में पूरा link आता है (…/#/verify/041788470776) — उसमें से आखिरी 12 अंक
    const digits = (text.match(/\d{12}/g) || []).pop();
    setBusy(true);
    try {
      let inv = null;
      if (digits) {
        inv = await api.invoiceByBarcode(digits).catch((e) => {
          if (e.status === 404) return null;
          throw e;
        });
      }
      if (!inv) {
        const list = await api.searchInvoices(digits || text);
        const up = text.toUpperCase();
        inv = list.find((i) => String(i.id).toUpperCase().endsWith(up)) || (list.length === 1 ? list[0] : null);
        if (!inv && list.length > 1) {
          toast(`"${text}" से ${list.length} बिल मिले — पूरा बिल नंबर या barcode डालें`);
          return;
        }
      }
      if (!inv) {
        toast('यह बिल नहीं मिला — barcode / बिल नंबर जाँचें');
        return;
      }
      setQ('');
      // key — एक बिल खुला हो और दूसरा स्कैन हो, तो नया बिल ही दिखे (पुराना state न रहे)
      openModal(<InvoiceModal key={inv.id} inv={inv} settings={db.settings} />, true);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  // scanner बहुत तेज़ लिखता है (हर अक्षर 60ms के अंदर) — इंसान की टाइपिंग से अलग पहचान
  useEffect(() => {
    let buf = '';
    let last = 0;
    function onKey(e) {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const now = Date.now();
      if (now - last > 60) buf = '';
      last = now;
      if (e.key === 'Enter') {
        if (/\d{12}/.test(buf)) find(buf);
        buf = '';
      } else if (e.key.length === 1) {
        buf += e.key;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <form className="bill-scan" onSubmit={(e) => { e.preventDefault(); find(q); }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="📷 बिल स्कैन करें या बिल नंबर"
        aria-label="बिल का barcode, QR या बिल नंबर"
      />
      <button type="submit" disabled={busy}>{busy ? '…' : 'खोजें'}</button>
    </form>
  );
}

export default function Topbar({ view }) {
  const { db } = useData();
  return (
    <div className="topbar">
      <div className="topbar-title">
        <div className="topbar-logo"><LogoIcon round /></div>
        <div>
          <h2>{TITLES[view]}</h2>
          <div className="meta">{fmtDate(new Date())}</div>
        </div>
      </div>
      <BillScan />
      <div className="rate-pill">
        <span>Gold: <b>{db.rates.gold ? inr(db.rates.gold) : '--'}</b>/g</span>
        <span>Silver: <b>{db.rates.silver ? inr(db.rates.silver) : '--'}</b>/g</span>
      </div>
    </div>
  );
}
