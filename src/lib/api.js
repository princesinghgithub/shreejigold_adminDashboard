// backend से बात करने की एक ही जगह.
//
// पता हमेशा '/api' रहता है और दोनों हालत में सही निकलता है:
//  • dev में — vite.config.js का proxy इसे backend (पोर्ट 4000) पर भेज देता है
//  • असली इस्तेमाल में — backend खुद बना हुआ ऐप परोसता है, तो यह उसी सर्वर पर जाता है
// इसीलिए मोबाइल से खोलने पर भी कुछ बदलना नहीं पड़ता, और CORS बीच में आता ही नहीं.
// hosting पर SHREEJI_URL में backend का पता (जैसे https://shreejigoldbackend.vercel.app/api).
// पुराना नाम VITE_API_URL भी चलता है.
export const API_URL = (import.meta.env.SHREEJI_URL || import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

/** गड़बड़ी के संदेश में दिखाने लायक पूरा पता */
export function apiDisplayUrl() {
  try { return new URL(API_URL, window.location.origin).href; } catch { return API_URL; }
}

const TOKEN_KEY = 'shop-token';

export function getToken() {
  try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(t) {
  try { window.localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ }
}
export function clearToken() {
  try { window.localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** टोकन पुराना पड़ने पर ऐप को लॉगिन पर वापस भेजना है — App.jsx यहाँ हाथ लगाता है */
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

async function request(method, path, body, opts = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token && !opts.noAuth ? { authorization: 'Bearer ' + token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      'सर्वर से बात नहीं हो पा रही — देख लें कि backend चालू है (' + API_URL + ')', 0,
    );
  }

  if (res.status === 401 && !opts.noAuth && onUnauthorized) onUnauthorized();

  const text = await res.text();
  let data = null;
  let isJson = true;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; isJson = false; }

  // backend की जगह कोई HTML पेज आया (hosting पर SHREEJI_URL नहीं डाला या पता गलत है).
  // इसे "कोई खाता नहीं" जैसा जवाब मानकर गलत स्क्रीन (जैसे खाता बनाने का फॉर्म) न दिखे
  if (!isJson) {
    throw new ApiError(
      'backend से नहीं जुड़ पाए — ' + apiDisplayUrl() + ' पर API नहीं मिली। Hosting पर SHREEJI_URL में backend का पता डालें।',
      0,
    );
  }

  if (!res.ok) {
    // data की जाँच वाली गलती में असली वजह details में आती है (जैसे "Purity 0 से 100% के बीच…")
    const detail = data && Array.isArray(data.details) && data.details[0] && data.details[0].message;
    const msg = detail || (data && data.error) || 'कुछ गड़बड़ हुई (' + res.status + ')';
    throw new ApiError(msg, res.status, data && data.details);
  }
  return data;
}

const get = (p, o) => request('GET', p, undefined, o);
const post = (p, b, o) => request('POST', p, b === undefined ? {} : b, o);
const put = (p, b) => request('PUT', p, b);
const del = (p) => request('DELETE', p);

const qs = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  }
  const s = p.toString();
  return s ? '?' + s : '';
};

export const api = {
  health: () => get('/health', { noAuth: true }),

  // ---- लॉगिन ----
  authStatus: () => get('/auth/status', { noAuth: true }),
  setup: (payload) => post('/auth/setup', payload, { noAuth: true }),
  login: (userId, password) => post('/auth/login', { userId, password }, { noAuth: true }),
  me: () => get('/auth/me'),
  forgotQuestion: (userId) => get('/auth/forgot' + qs({ userId }), { noAuth: true }),
  forgotReset: (userId, answer, newPassword) =>
    post('/auth/forgot', { userId, answer, newPassword }, { noAuth: true }),
  forgotSendOtp: (userId) => post('/auth/forgot/otp', { userId }, { noAuth: true }),
  forgotVerifyOtp: (userId, otp, newPassword) =>
    post('/auth/forgot/otp/verify', { userId, otp, newPassword }, { noAuth: true }),
  changePassword: (oldPassword, newPassword) =>
    post('/auth/change-password', { oldPassword, newPassword }),
  changeUserId: (password, newUserId) => post('/auth/change-userid', { password, newUserId }),
  setSecurityQuestion: (password, question, answer) =>
    post('/auth/security-question', { password, question, answer }),

  // ---- पूरा डेटा एक साथ (ऐप का db इसी shape में है) ----
  snapshot: () => get('/backup'),

  // ---- दुकान ----
  getRates: () => get('/shop/rates'),
  saveRates: (rates) => put('/shop/rates', rates),
  getSettings: () => get('/shop/settings'),
  saveSettings: (s) => put('/shop/settings', s),
  dashboard: () => get('/shop/dashboard'),

  // ---- ग्राहक ----
  createCustomer: (c) => post('/customers', c),
  updateCustomer: (id, c) => put('/customers/' + id, c),
  deleteCustomer: (id) => del('/customers/' + id),
  addLedger: (id, entry) => post('/customers/' + id + '/ledger', entry),

  // ---- स्टॉक ----
  createStock: (s) => post('/stock', s),
  updateStock: (id, s) => put('/stock/' + id, s),
  deleteStock: (id) => del('/stock/' + id),

  // ---- बिल ----
  createInvoice: (inv) => post('/invoices', inv),
  deleteInvoice: (id) => del('/invoices/' + id),
  recordPayment: (id, amount, note) => post('/invoices/' + id + '/payment', { amount, note }),
  invoiceByBarcode: (code) => get('/invoices/barcode/' + encodeURIComponent(code)),
  searchInvoices: (q) => get('/invoices' + qs({ search: q, limit: 10 })),

  // ---- ऑफर ----
  createOffer: (o) => post('/offers', o),
  updateOffer: (id, o) => put('/offers/' + id, o),
  deleteOffer: (id) => del('/offers/' + id),

  // ---- backup ----
  restore: (data) => post('/backup/restore', data),
  seedDemo: () => post('/backup/seed-demo'),
  clearAll: () => del('/backup/all'),
  listSnapshots: () => get('/backup/snapshots'),
  createSnapshot: () => post('/backup/snapshots'),
  getSnapshot: (id) => get('/backup/snapshots/' + id),
  restoreSnapshot: (id) => post('/backup/snapshots/' + id + '/restore'),

  // ---- website catalog ----
  listCatalog: () => get('/catalog'),
  createCatalogItem: (p) => post('/catalog', p),
  updateCatalogItem: (id, p) => put('/catalog/' + id, p),
  deleteCatalogItem: (id) => del('/catalog/' + id),
  importWebsiteCatalog: () => post('/catalog/import-defaults'),

  // ---- website से आई leads ----
  listLeads: (status) => get('/leads' + qs({ status })),
  updateLead: (id, data) => put('/leads/' + id, data),
  deleteLead: (id) => del('/leads/' + id),

  // ---- दुकान के users (staff / admin) ----
  listUsers: () => get('/users'),
  createUser: (u) => post('/users', u),
  updateUser: (id, u) => put('/users/' + id, u),
  deleteUser: (id) => del('/users/' + id),
};

/** backend पर रखी फोटो (/api/public/...) का पूरा पता — बाहर के link वैसे ही */
export function assetUrl(path) {
  if (!path || !path.startsWith('/api/')) return path || '';
  return API_URL.replace(/\/api$/, '') + path;
}
