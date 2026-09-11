import { useEffect, useState } from 'react';
import { useData } from './context/DataContext';
import { useToast } from './context/ToastContext';
import { DataProvider } from './context/DataContext';
import { ModalProvider } from './context/ModalContext';
import { ToastProvider } from './context/ToastContext';
import { PrintProvider } from './context/PrintContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { api, getToken, clearToken, setUnauthorizedHandler } from './lib/api';

import Dashboard from './pages/Dashboard';
import Rates from './pages/Rates';
import Billing from './pages/Billing';
import Exchange from './pages/Exchange';
import Customers from './pages/Customers';
import Stock from './pages/Stock';
import Reports from './pages/Reports';
import Offers from './pages/Offers';
import Backup from './pages/Backup';
import Catalog from './pages/Catalog';
import Leads from './pages/Leads';
import Users from './pages/Users';

const PAGES = {
  dashboard: Dashboard,
  rates: Rates,
  billing: Billing,
  exchange: Exchange,
  customers: Customers,
  stock: Stock,
  reports: Reports,
  offers: Offers,
  catalog: Catalog,
  leads: Leads,
  users: Users,
  backup: Backup,
};

// ये पेज सिर्फ मालिक / Admin के लिए (सर्वर भी staff को रोकता है)
const ADMIN_ONLY = new Set(['users', 'backup']);

function Shell() {
  const [view, setView] = useState('dashboard');
  // टोकन पहले से पड़ा है तो सीधे अंदर जाने की कोशिश करते हैं
  const [loggedIn, setLoggedIn] = useState(() => Boolean(getToken()));
  const [me, setMe] = useState(null); // { sub, name, role: owner | admin | staff }
  const { status, error, refresh } = useData();
  const toast = useToast();

  // टोकन पुराना पड़ जाए तो कहीं भी हों, लॉगिन पर वापस
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken();
      setLoggedIn(false);
    });
  }, []);

  // लॉगिन होते ही सर्वर से पूरा डेटा
  useEffect(() => {
    if (loggedIn) refresh();
  }, [loggedIn, refresh]);

  // कौन लॉगिन है — sidebar और पेज उसी हिसाब से
  useEffect(() => {
    if (!loggedIn) {
      setMe(null);
      return;
    }
    api.me().then((r) => setMe(r.user)).catch(() => { /* 401 पर ऊपर वाला handler लॉगआउट करेगा */ });
  }, [loggedIn]);

  async function handleLoginSuccess(firstTime) {
    setLoggedIn(true);
    if (!firstTime) return;
    // बिलकुल नया खाता और सर्वर पर कोई डेटा नहीं — तभी देखने के लिए demo डेटा भरते हैं.
    // (reset-password के बाद नया खाता बने तो दुकान का असली डेटा नहीं मिटना चाहिए)
    try {
      const data = await api.snapshot();
      const empty = ['customers', 'stock', 'invoices', 'offers'].every((k) => !(data[k] || []).length);
      if (!empty) return;
      await api.seedDemo();
      await refresh();
      toast('डेमो डेटा भर दिया गया है — देख लें, चाहें तो Backup से मिटा सकते हैं ✔');
    } catch { /* न भर सके तो भी ऐप खाली चल जाएगा */ }
  }

  function handleLogout() {
    clearToken();
    setLoggedIn(false);
    setView('dashboard');
  }

  if (!loggedIn) {
    return <Login onSuccess={handleLoginSuccess} />;
  }

  if (status === 'loading' || status === 'idle') {
    return <div className="boot"><div className="boot-card">डेटा आ रहा है…</div></div>;
  }

  if (status === 'error') {
    return (
      <div className="boot">
        <div className="boot-card">
          <h3>सर्वर से डेटा नहीं मिला</h3>
          <p className="err">{error}</p>
          <div className="row-actions" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={refresh}>दोबारा कोशिश करें</button>
            <button className="btn btn-ghost" onClick={handleLogout}>लॉगआउट</button>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = Boolean(me && (me.role === 'owner' || me.role === 'admin'));
  const Page = ADMIN_ONLY.has(view) && !isAdmin ? Dashboard : PAGES[view];

  return (
    <div id="app" style={{ display: 'block' }}>
      <div className="shell">
        <Sidebar view={view} setView={setView} onLogout={handleLogout} me={me} />
        <div className="main">
          <Topbar view={view} />
          <div id="view"><Page /></div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    // PrintProvider, ModalProvider के बाहर होना चाहिए — modal का content ModalProvider खुद
    // render करता है, और बिल वाला modal (InvoiceModal) Print/PDF के लिए usePrint माँगता है
    <DataProvider>
      <ToastProvider>
        <PrintProvider>
          <ModalProvider>
            <Shell />
          </ModalProvider>
        </PrintProvider>
      </ToastProvider>
    </DataProvider>
  );
}
