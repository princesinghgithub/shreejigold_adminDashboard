import { useData } from '../context/DataContext';
import { todayStr, daysAgo, fmtDate, inr } from '../lib/format';
import InvoiceTable from '../components/InvoiceTable';

function MiniChart({ invoices }) {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(daysAgo(i));
  const totals = days.map((d) => invoices.filter((i) => i.type === 'sale' && i.date === d).reduce((s, i) => s + i.total, 0));
  const max = Math.max(...totals, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 140, paddingTop: 10 }}>
      {days.map((d, idx) => {
        const h = Math.max(4, Math.round((totals[idx] / max) * 110));
        const lbl = new Date(d).toLocaleDateString('en-IN', { weekday: 'short' });
        return (
          <div key={d} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 4 }}>{totals[idx] ? inr(totals[idx]) : ''}</div>
            <div style={{ height: h, background: 'linear-gradient(180deg,var(--gold-light),var(--gold))', borderRadius: '5px 5px 2px 2px' }}></div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 5 }}>{lbl}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { db } = useData();
  const inv = db.invoices;
  const today = todayStr();
  const monthStr = today.slice(0, 7);
  const todaySales = inv.filter((i) => i.type === 'sale' && i.date === today).reduce((s, i) => s + i.total, 0);
  const monthSales = inv.filter((i) => i.type === 'sale' && i.date.slice(0, 7) === monthStr).reduce((s, i) => s + i.total, 0);
  const totalDue = db.customers.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);
  const stockCount = db.stock.reduce((s, i) => s + Number(i.qty || 0), 0);
  const activeOffers = db.offers.filter((o) => !o.endDate || o.endDate >= today).slice(0, 5);
  const topDue = db.customers.filter((c) => c.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5);

  return (
    <div>
      <div className="stat-cards">
        <div className="stat"><div className="lbl">आज की बिक्री</div><div className="val">{inr(todaySales)}</div></div>
        <div className="stat"><div className="lbl">इस महीने की बिक्री</div><div className="val">{inr(monthSales)}</div></div>
        <div className="stat"><div className="lbl">कुल उधारी (बकाया)</div><div className="val">{inr(totalDue)}</div></div>
        <div className="stat"><div className="lbl">कुल Stock (नग)</div><div className="val">{stockCount}</div></div>
      </div>
      <div className="card">
        <h3>पिछले 7 दिन की बिक्री</h3>
        <MiniChart invoices={inv} />
      </div>
      <div className="card">
        <h3>हाल की बिलिंग</h3>
        <InvoiceTable list={inv.slice().reverse().slice(0, 8)} />
      </div>
      <div className="grid grid-2">
        <div className="card">
          <h3>चालू Offers</h3>
          {activeOffers.length ? activeOffers.map((o) => (
            <div key={o.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 13.5 }}>
              <b>{o.title}</b> — {o.discountPercent}% छूट <span style={{ color: 'var(--ink-soft)' }}>({o.endDate ? 'तक ' + fmtDate(o.endDate) : 'बिना समय सीमा'})</span>
            </div>
          )) : <div className="empty">कोई Active offer नहीं</div>}
        </div>
        <div className="card">
          <h3>ज़्यादा उधारी वाले Customer</h3>
          {topDue.length ? topDue.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 13.5 }}>
              <span>{c.name}</span><b style={{ color: 'var(--red)' }}>{inr(c.balance)}</b>
            </div>
          )) : <div className="empty">कोई उधारी नहीं</div>}
        </div>
      </div>
    </div>
  );
}
