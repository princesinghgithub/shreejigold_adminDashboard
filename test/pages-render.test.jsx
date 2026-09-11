// हर पेज को असली सर्वर के डेटा के साथ render करके देखते हैं कि कहीं टूटता तो नहीं.
import { renderToStaticMarkup } from 'react-dom/server';
import { DataContext } from '../src/context/DataContext.jsx';
import { ToastProvider } from '../src/context/ToastContext.jsx';
import { ModalProvider } from '../src/context/ModalContext.jsx';
import { PrintProvider } from '../src/context/PrintContext.jsx';

import Dashboard from '../src/pages/Dashboard.jsx';
import Rates from '../src/pages/Rates.jsx';
import Billing from '../src/pages/Billing.jsx';
import Exchange from '../src/pages/Exchange.jsx';
import Customers from '../src/pages/Customers.jsx';
import Stock from '../src/pages/Stock.jsx';
import Reports from '../src/pages/Reports.jsx';
import Offers from '../src/pages/Offers.jsx';
import BackupPage from '../src/pages/Backup.jsx';
import Sidebar from '../src/components/Sidebar.jsx';
import Topbar from '../src/components/Topbar.jsx';
import Login from '../src/components/Login.jsx';
import InvoiceModal from '../src/components/InvoiceModal.jsx';
import InvoiceSlip from '../src/components/InvoiceSlip.jsx';
import InvoiceView from '../src/components/InvoiceView.jsx';
import LoginSettings from '../src/components/LoginSettings.jsx';

const BASE = process.env.API || 'http://localhost:4000/api';

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '  ' + String(extra).slice(0, 500)); }
};

// ---- सर्वर से असली डेटा ----
async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await res.text();
  try { return JSON.parse(t); } catch { return t; }
}

const status = await call('GET', '/auth/status');
let token;
if (!status.isSetup) {
  token = (await call('POST', '/auth/setup', {
    userId: 'chhotelal', password: 'soniji123', question: 'गाँव?', answer: 'खतखरी',
  })).token;
} else {
  token = (await call('POST', '/auth/login', { userId: 'chhotelal', password: 'soniji123' })).token;
}
if (!token) { console.log('लॉगिन नहीं हुआ — सर्वर देखें'); process.exit(1); }

await call('POST', '/backup/seed-demo', {}, token);
const db = await call('GET', '/backup', undefined, token);
console.log('सर्वर से मिला: ' + db.customers.length + ' ग्राहक, ' + db.invoices.length
  + ' बिल, ' + db.stock.length + ' स्टॉक, ' + db.offers.length + ' ऑफर\n');

const ctx = {
  db, status: 'ready', error: '',
  refresh: async () => true,
  mutate: async (fn) => fn(),
  reset: () => {},
};

function render(name, node) {
  try {
    const html = renderToStaticMarkup(
      <DataContext.Provider value={ctx}>
        <ToastProvider><ModalProvider><PrintProvider>{node}</PrintProvider></ModalProvider></ToastProvider>
      </DataContext.Provider>,
    );
    check(name + ' (' + html.length + ' अक्षर)', html.length > 50, 'बहुत छोटा output');
    return html;
  } catch (e) {
    check(name, false, e.message + '\n      ' + String(e.stack).split('\n')[1]);
    return '';
  }
}

console.log('-- हर पेज --');
const dash = render('Dashboard', <Dashboard />);
render('Rates (Settings)', <Rates />);
render('Billing', <Billing />);
render('Exchange', <Exchange />);
const custHtml = render('Customers', <Customers />);
const stockHtml = render('Stock', <Stock />);
render('Reports', <Reports />);
const offerHtml = render('Offers', <Offers />);
render('Backup', <BackupPage />);

console.log('\n-- ढाँचे के हिस्से --');
render('Sidebar', <Sidebar view="dashboard" setView={() => {}} onLogout={() => {}} />);
render('Topbar', <Topbar view="dashboard" />);
render('Login', <Login onSuccess={() => {}} />);
render('LoginSettings', <LoginSettings />);

console.log('\n-- बिल --');
const inv = db.invoices[0];
const slip = render('InvoiceSlip', <InvoiceSlip inv={inv} settings={db.settings} />);
render('InvoiceView (सादा)', <InvoiceView inv={inv} settings={db.settings} />);
render('InvoiceModal', <InvoiceModal inv={inv} settings={db.settings} />);

console.log('\n-- असली डेटा पेज पर दिख रहा है? --');
check('Dashboard पर ग्राहकों की गिनती', dash.includes(String(db.customers.length)), 'नहीं मिली');
check('Customers पेज पर पहला ग्राहक', custHtml.includes(db.customers[0].name), db.customers[0].name);
check('Stock पेज पर पहला आइटम', stockHtml.includes(db.stock[0].name), db.stock[0].name);
check('Offers पेज पर पहला ऑफर', offerHtml.includes(db.offers[0].title), db.offers[0].title);
check('बिल पर दुकान का नाम', slip.includes(db.settings.shopNameHindi), db.settings.shopNameHindi);
check('बिल पर लोगो', slip.includes('shreeji.png'), 'लोगो नहीं मिला');
check('बिल पर सारे item', db.invoices[0].items.every((it) => slip.includes(it.name)), 'कोई item छूटा');

console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
