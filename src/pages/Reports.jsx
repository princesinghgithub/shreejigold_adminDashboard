import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { todayStr } from '../lib/format';
import { summarizeInvoices } from '../lib/calc';
import { inr } from '../lib/format';
import { billNoOf } from '../lib/bill';
import InvoiceTable from '../components/InvoiceTable';

function RepBlock({ s }) {
  return (
    <div>
      <div className="summary-line"><span>बिक्री बिल (संख्या)</span><span>{s.saleCount}</span></div>
      <div className="summary-line"><span>बिक्री राशि</span><span>{inr(s.saleTotal)}</span></div>
      <div className="summary-line"><span>खरीद बिल (संख्या)</span><span>{s.purchaseCount}</span></div>
      <div className="summary-line"><span>खरीद राशि</span><span>{inr(s.purchaseTotal)}</span></div>
      <div className="summary-line"><span>कुल GST</span><span>{inr(s.gstTotal)}</span></div>
      <div className="summary-line total"><span>बकाया राशि</span><span>{inr(s.dueTotal)}</span></div>
    </div>
  );
}

export default function Reports() {
  const { db } = useData();
  const toast = useToast();
  const today = todayStr();
  const monthStr = today.slice(0, 7);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(today);
  const [custId, setCustId] = useState('');
  const [gstFilter, setGstFilter] = useState('');
  const [rangeList, setRangeList] = useState(null);

  const dailyList = db.invoices.filter((i) => i.date === today);
  const monthlyList = db.invoices.filter((i) => i.date.slice(0, 7) === monthStr);

  function getFiltered() {
    return db.invoices.filter((i) =>
      (!from || i.date >= from) &&
      (!to || i.date <= to) &&
      (!custId || i.customerId === custId) &&
      (!gstFilter || (gstFilter === 'nongst' ? i.gstMode === 'nongst' : i.gstMode !== 'nongst'))
    );
  }

  function runRangeReport() {
    setRangeList(getFiltered());
  }

  function downloadCSV() {
    const list = getFiltered();
    if (!list.length) { toast('इस Filter में कोई बिल नहीं मिला'); return; }
    const headers = ['Date', 'Bill No', 'Type', 'Bill Mode', 'Customer', 'Phone', 'PAN', 'Subtotal', 'Making', 'Hallmark', 'Old Gold Weight', 'Old Gold Value', 'Discount', 'GST %', 'GST Amount', 'Round Off', 'Total', 'Paid', 'Payment Modes', 'Due'];
    const rows = list.map((i) => [
      i.date, billNoOf(i), i.type, (i.gstMode === 'nongst' ? 'Non-GST' : 'GST'),
      i.customerName, i.customerPhone || '', i.customerPan || '', i.subtotal.toFixed(2), i.making.toFixed(2),
      Number(i.hallmark || 0).toFixed(2),
      Number((i.exchange && i.exchange.weight) || 0).toFixed(3), Number((i.exchange && i.exchange.value) || 0).toFixed(2),
      i.discount.toFixed(2), i.gstPct, i.gst.toFixed(2), Number(i.roundOff || 0).toFixed(2),
      i.total.toFixed(2), i.paid.toFixed(2), (i.payments || []).map((p) => `${p.mode} ${p.amount}`).join(' | '), i.due.toFixed(2),
    ]);
    const csvLines = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'SoniJiJewellers_Report_' + todayStr() + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Report Download हो गया ✔');
  }

  return (
    <div>
      <div className="grid grid-2">
        <div className="card"><h3>Daily Report — आज</h3><RepBlock s={summarizeInvoices(dailyList)} /></div>
        <div className="card"><h3>Monthly Report — {monthStr}</h3><RepBlock s={summarizeInvoices(monthlyList)} /></div>
      </div>
      <div className="card">
        <h3>Custom Date Range Report</h3>
        <div className="grid grid-4">
          <div className="field"><label>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="field"><label>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="field"><label>Customer</label>
            <select value={custId} onChange={(e) => setCustId(e.target.value)}>
              <option value="">-- सभी Customer --</option>
              {db.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field"><label>बिल प्रकार</label>
            <select value={gstFilter} onChange={(e) => setGstFilter(e.target.value)}>
              <option value="">सभी</option>
              <option value="gst">केवल GST बिल</option>
              <option value="nongst">केवल Non-GST</option>
            </select>
          </div>
        </div>
        <div className="row-actions">
          <button className="btn btn-primary" onClick={runRangeReport}>Report देखें</button>
          <button className="btn btn-outline" onClick={downloadCSV}>⬇ Report Download करें (CSV)</button>
        </div>
        {rangeList && (
          <div>
            <RepBlock s={summarizeInvoices(rangeList)} />
            <InvoiceTable list={rangeList.slice().reverse()} />
          </div>
        )}
      </div>
      <div className="card"><h3>सभी Invoices</h3><InvoiceTable list={db.invoices.slice().reverse()} /></div>
    </div>
  );
}
