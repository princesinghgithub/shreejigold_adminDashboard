import { useState } from 'react';
import { useData } from '../context/DataContext';
import { fmtDate, inr } from '../lib/format';

export default function Exchange() {
  const { db } = useData();
  const [w, setW] = useState(0);
  const [p, setP] = useState(91.6);
  const [d, setD] = useState(2);
  const [r, setR] = useState(db.rates.gold || 0);
  const [result, setResult] = useState(null);

  function calc() {
    const val = Number(w) * (Number(p) / 100) * (1 - Number(d) / 100) * Number(r);
    setResult(val);
  }

  const history = db.invoices.filter((i) => i.exchange && i.exchange.value > 0).slice().reverse();

  return (
    <div>
      <div className="card" style={{ maxWidth: 560 }}>
        <h3>पुराना सोना Exchange कैलकुलेटर</h3>
        <p className="small-note">बिलिंग बनाते समय भी exchange जोड़ सकते हैं — यह सिर्फ अनुमानित value निकालने के लिए है।</p>
        <div className="grid grid-2">
          <div className="field"><label>वजन (g)</label><input type="number" value={w} onChange={(e) => setW(e.target.value)} /></div>
          <div className="field"><label>Purity %</label><input type="number" value={p} onChange={(e) => setP(e.target.value)} /></div>
        </div>
        <div className="grid grid-2">
          <div className="field"><label>कटौती % (wastage/melting loss)</label><input type="number" value={d} onChange={(e) => setD(e.target.value)} /></div>
          <div className="field"><label>Rate (₹/g, 24K आधार)</label><input type="number" value={r} onChange={(e) => setR(e.target.value)} /></div>
        </div>
        <button className="btn btn-primary" onClick={calc}>Value निकालें</button>
        {result !== null && <div style={{ marginTop: 14, fontSize: 16, fontWeight: 700, color: 'var(--maroon-dark)' }}>अनुमानित Value: {inr(result)}</div>}
      </div>
      <div className="card">
        <h3>Exchange History (बिल में जोड़े गए)</h3>
        <div className="tbl-wrap">
          <table>
            <tbody>
              <tr><th>तारीख</th><th>Customer</th><th>वजन</th><th>Purity</th><th>कटौती</th><th>Value</th></tr>
              {history.length ? history.map((i) => (
                <tr key={i.id}>
                  <td>{fmtDate(i.date)}</td><td>{i.customerName}</td><td>{i.exchange.weight}g</td>
                  <td>{i.exchange.purity}%</td><td>{i.exchange.deduct}%</td><td>{inr(i.exchange.value)}</td>
                </tr>
              )) : <tr><td colSpan={6} className="empty">कोई Exchange history नहीं</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
