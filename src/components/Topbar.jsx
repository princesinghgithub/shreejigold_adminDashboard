import { useEffect, useRef, useState } from 'react';
import { LogoIcon } from './Logo';
import { fmtDate, inr } from '../lib/format';
import { useData } from '../context/DataContext';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { billNoOf } from '../lib/bill';
import InvoiceModal from './InvoiceModal';
import CustomerModal from './CustomerModal';

const TITLES = {
  dashboard: 'डैशबोर्ड', rates: 'आज का Rate', billing: 'बिलिंग', exchange: 'पुराना सोना Exchange',
  customers: 'Customer / उधारी', stock: 'Stock Management', reports: 'Sales Reports', offers: 'Offers', backup: 'Data Backup',
  catalog: 'Website Catalog', leads: 'Website Leads', users: 'Users / Staff',
};

/**
 * एक ही खाने से सब कुछ — ग्राहक का नाम/नंबर, बिल नंबर, या बिल का barcode / QR.
 * नाम लिखते ही नीचे सूची आ जाती है; एक ही ग्राहक मिले तो Enter से सीधा उसका खाता खुलता है.
 * Scanner कीबोर्ड की तरह अंक लिखकर Enter दबाता है: इस खाने में cursor हो तो सीधा, और
 * किसी खाने में न हो तब भी पकड़ लिया जाता है.
 */
function GlobalSearch() {
  const { db } = useData();
  const { openModal } = useModal();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // लिखते-लिखते सूची — हर अक्षर पर नहीं, रुकने पर
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2 || /^\d{12}$/.test(text)) { setRes(null); setOpen(false); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      api.search(text)
        .then((r) => { if (alive) { setRes(r); setOpen(true); } })
        .catch(() => { /* खोज न चले तो चुपचाप — Enter पर संदेश मिल ही जाएगा */ });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  // बाहर कहीं click हो तो सूची बंद
  useEffect(() => {
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function showCustomer(id) {
    setOpen(false);
    setQ('');
    openModal(<CustomerModal key={id} customerId={id} />, true);
  }

  async function showBill(inv) {
    setOpen(false);
    setQ('');
    // सूची में बिल का छोटा रूप आता है — छापने के लिए पूरा बिल चाहिए
    const full = inv.items ? inv : await api.getInvoice(inv.id).catch((e) => { toast(e.message); return null; });
    if (!full) return;
    // बिल से ग्राहक का पूरा खाता एक ही click दूर रहे
    const back = full.customerId
      ? {
        label: full.customerName,
        onClick: () => openModal(<CustomerModal key={full.customerId} customerId={full.customerId} />, true),
      }
      : null;
    openModal(<InvoiceModal key={full.id} inv={full} settings={db.settings} backTo={back} />, true);
  }

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
      // छपा बिल नंबर — "257", "E-12", "p5". एक से ज़्यादा साल में हो तो सबसे नया
      if (!inv && /^[EP]?-?\d{1,7}$/i.test(text)) {
        const no = text.toUpperCase().replace(/^([EP])-?/, '$1-');
        const list = await api.invoicesByBillNo(no);
        if (list.length) inv = list[0];
      }
      if (inv) { await showBill(inv); return; }

      // बाकी सब — ग्राहक और बिल दोनों में खोजें
      const hits = await api.search(text);
      const { customers, invoices } = hits;
      if (customers.length === 1 && !invoices.length) { showCustomer(customers[0].id); return; }
      if (!customers.length && invoices.length === 1) { await showBill(invoices[0]); return; }
      if (!customers.length && !invoices.length) {
        toast(`"${text}" से कोई ग्राहक या बिल नहीं मिला`);
        setRes(null);
        setOpen(false);
        return;
      }
      setRes(hits);
      setOpen(true);
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

  const customers = (res && res.customers) || [];
  const invoices = (res && res.invoices) || [];

  return (
    <div className="search-wrap" ref={wrapRef}>
      <form className="bill-scan" onSubmit={(e) => { e.preventDefault(); find(q); }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => { if (res) setOpen(true); }}
          placeholder="🔍 ग्राहक का नाम, बिल नंबर या स्कैन"
          aria-label="ग्राहक का नाम, फ़ोन, बिल नंबर या barcode"
        />
        <button type="submit" disabled={busy}>{busy ? '…' : 'खोजें'}</button>
      </form>

      {open && (customers.length || invoices.length) ? (
        <div className="search-drop">
          {customers.length ? <div className="search-head">ग्राहक</div> : null}
          {customers.map((c) => (
            <button type="button" className="search-row" key={c.id} onClick={() => showCustomer(c.id)}>
              <span>
                <b>{c.name}</b>
                <span className="sub">
                  {c.phone || 'नंबर नहीं'}{c.bills ? ` · ${c.bills} बिल` : ''}
                  {c.lastBillDate ? ` · आख़िरी ${fmtDate(c.lastBillDate)}` : ''}
                </span>
              </span>
              <span className="amt">
                {c.balance > 0
                  ? <span className="badge badge-due">{inr(c.balance)} बाकी</span>
                  : c.balance < 0
                    ? <span className="badge badge-paid">{inr(-c.balance)} एडवांस</span>
                    : <span className="badge badge-paid">Clear</span>}
              </span>
            </button>
          ))}

          {invoices.length ? <div className="search-head">बिल</div> : null}
          {invoices.map((i) => (
            <button type="button" className="search-row" key={i.id} onClick={() => showBill(i)}>
              <span>
                <b>बिल नं. {billNoOf(i)}</b>
                <span className="sub">{fmtDate(i.date)} · {i.customerName}</span>
              </span>
              <span className="amt">
                {inr(i.total)}
                {i.due > 0 ? <span className="badge badge-due" style={{ marginLeft: 6 }}>बाकी</span> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
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
      <GlobalSearch />
      <div className="rate-pill">
        <span>Gold: <b>{db.rates.gold ? inr(db.rates.gold) : '--'}</b>/g</span>
        <span>Silver: <b>{db.rates.silver ? inr(db.rates.silver) : '--'}</b>/g</span>
      </div>
    </div>
  );
}
