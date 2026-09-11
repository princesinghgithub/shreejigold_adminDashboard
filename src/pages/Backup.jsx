import { useEffect, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { api, apiDisplayUrl } from '../lib/api';
import { todayStr, fmtDate } from '../lib/format';

export default function Backup() {
  const { db, mutate, refresh } = useData();
  const toast = useToast();
  const fileRef = useRef(null);
  const [snaps, setSnaps] = useState([]);
  const [busy, setBusy] = useState(false);

  async function loadSnaps() {
    try { setSnaps(await api.listSnapshots()); } catch { /* सूची न मिले तो भी पेज चले */ }
  }
  useEffect(() => { loadSnaps(); }, []);

  async function run(fn, okMsg) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast(okMsg);
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SoniJiJewellers_Backup_' + todayStr() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('Backup Download हो गया ✔');
  }

  function restoreBackup() {
    const f = fileRef.current?.files?.[0];
    if (!f) { toast('पहले फाइल चुनें'); return; }
    if (!window.confirm('मौजूदा सारा डेटा हट जाएगा और इस फाइल वाला डेटा भर जाएगा। जारी रखें?')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      let data;
      try { data = JSON.parse(e.target.result); } catch { toast('फाइल सही नहीं है'); return; }
      run(() => mutate(() => api.restore(data)), 'Data Restore हो गया ✔');
    };
    reader.readAsText(f);
  }

  function loadDemoNow() {
    if (!window.confirm('मौजूदा Customers, Stock, Bills हट जाएंगे और demo data भर जाएगा। जारी रखें?')) return;
    run(() => mutate(() => api.seedDemo()), 'डेमो डेटा भर दिया गया ✔');
  }

  function clearAllData() {
    if (!window.confirm('क्या आप वाकई पूरा डेटा (Customers, Stock, Bills, Offers, Rates) हमेशा के लिए मिटाना चाहते हैं?')) return;
    run(() => mutate(() => api.clearAll()), 'पूरा डेटा मिटा दिया गया');
  }

  function makeSnapshot() {
    run(async () => { await api.createSnapshot(); await loadSnaps(); }, 'कॉपी बन गई ✔');
  }

  function restoreSnap(s) {
    if (!window.confirm(fmtDate(s.createdAt) + ' वाली कॉपी वापस लाएं? मौजूदा सारा डेटा उससे बदल जाएगा।')) return;
    run(() => mutate(() => api.restoreSnapshot(s.id)), 'कॉपी से डेटा वापस आ गया ✔');
  }

  const counts = {
    customers: db.customers.length, stock: db.stock.length,
    invoices: db.invoices.length, offers: db.offers.length,
  };

  return (
    <div>
      <div className="card" style={{ maxWidth: 620 }}>
        <h3>डेटा कहाँ सेव होता है</h3>
        <p className="small-note">
          आपका सारा डेटा <b>MongoDB</b> में रहता है — ब्राउज़र में नहीं। इसलिए यही हिसाब
          दुकान के कंप्यूटर, मोबाइल — हर जगह एक जैसा दिखेगा, और ब्राउज़र साफ़ करने से कुछ नहीं मिटेगा।
        </p>
        <p className="small-note">सर्वर का पता: <code>{apiDisplayUrl()}</code></p>
        <p className="small-note">
          अभी सर्वर पर: <b>{counts.customers}</b> ग्राहक · <b>{counts.invoices}</b> बिल ·
          <b> {counts.stock}</b> स्टॉक आइटम · <b>{counts.offers}</b> ऑफर
        </p>
        <button className="btn btn-outline" onClick={refresh}>ताज़ा करें</button>
      </div>

      <div className="card" style={{ maxWidth: 620 }}>
        <h3>अपने आप बनने वाली कॉपियाँ</h3>
        <p className="small-note">
          रोज़ एक बार पूरे डेटा की कॉपी अपने आप बन जाती है। गलती से कुछ मिट जाए तो
          यहीं से वापस लाया जा सकता है।
        </p>
        <button className="btn btn-primary" disabled={busy} onClick={makeSnapshot}>अभी कॉपी बनाएं</button>
        {snaps.length > 0 && (
          <table className="table" style={{ marginTop: 12 }}>
            <tbody>
              <tr><th>कब बनी</th><th>क्या-क्या</th><th></th></tr>
              {snaps.slice(0, 8).map((s) => (
                <tr key={s.id}>
                  <td>{fmtDate(s.createdAt)} {s.label === 'auto' ? '(अपने आप)' : ''}</td>
                  <td>{s.counts.invoices} बिल · {s.counts.customers} ग्राहक · {s.counts.stock} स्टॉक</td>
                  <td>
                    <button className="icon-btn" onClick={() => restoreSnap(s)}>वापस लाएं</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="small-note">
          ये कॉपियाँ डेटाबेस के अंदर ही रहती हैं और पिछली 30 बची रहती हैं। फिर भी महीने में
          एक बार नीचे से <b>.json backup</b> डाउनलोड करके अपने पास ज़रूर रखें।
        </p>
      </div>

      <div className="card" style={{ maxWidth: 620 }}>
        <h3>.json Backup लें</h3>
        <p className="small-note">
          पूरा डेटा (Rates, Customers, Stock, Bills, Offers) एक फाइल में डाउनलोड करें।
          यह फाइल दोबारा नीचे से restore की जा सकती है।
        </p>
        <button className="btn btn-primary" onClick={downloadBackup}>⬇ Backup Download करें (.json)</button>
      </div>

      <div className="card" style={{ maxWidth: 620 }}>
        <h3>Backup से Restore करें</h3>
        <p className="small-note">पुरानी backup फाइल अपलोड करके डेटा वापस लाएं। यह मौजूदा डेटा को बदल देगा — सावधानी से करें।</p>
        <input type="file" ref={fileRef} accept="application/json" />
        <button className="btn btn-outline" style={{ marginTop: 10 }} disabled={busy} onClick={restoreBackup}>Restore करें</button>
      </div>

      <div className="card" style={{ maxWidth: 620 }}>
        <h3>Demo Data</h3>
        <p className="small-note">टेस्ट करने के लिए sample Customers, Stock, Bills और Offers भरें, या पूरा डेटा मिटाकर नए सिरे से शुरू करें।</p>
        <div className="row-actions">
          <button className="btn btn-outline" disabled={busy} onClick={loadDemoNow}>Demo Data भरें</button>
          <button className="btn btn-ghost" disabled={busy} onClick={clearAllData}>⚠ पूरा Data मिटाएं</button>
        </div>
      </div>
    </div>
  );
}
