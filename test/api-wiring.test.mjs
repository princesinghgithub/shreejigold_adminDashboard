// ऐप की api.js को असली backend के सामने चलाकर देखते हैं — वही रास्ता जो ब्राउज़र लेता है.
// चलाने से पहले backend चालू होना चाहिए (backend में: node test/live-server.mjs)
const store = new Map();
globalThis.window = {
  location: { origin: 'http://localhost:4000' },
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

const { api, setToken, getToken, ApiError, setUnauthorizedHandler } = await import('../src/lib/api.js');
const { rememberSecret, nextCode } = await import('./twofa-helper.mjs');

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '  ' + String(JSON.stringify(extra)).slice(0, 300)); }
};
const grab = async (fn) => {
  try { return { ok: true, data: await fn() }; } catch (e) { return { ok: false, err: e }; }
};
const emsg = (r) => (r.err ? r.err.message : '');

/** मालिक का लॉगिन — पासवर्ड के बाद Authenticator (पहली बार QR वाला setup) */
async function finish2fa(r) {
  if (!r.ok || !r.data.step) return r;
  const { step, challenge, secret } = r.data;
  if (step === 'setup') {
    rememberSecret(secret);
    const code = await nextCode();
    return grab(() => api.twofaSetup(challenge, code));
  }
  const code = await nextCode();
  return grab(() => api.twofaVerify(challenge, code));
}

console.log('\n-- सर्वर से जुड़ना --');
let r = await grab(() => api.health());
if (!r.ok) { console.log('  backend नहीं चल रहा: ' + emsg(r)); process.exit(1); }
check('health', r.data.ok, r.data);

console.log('\n-- बिना लॉगिन कुछ नहीं --');
r = await grab(() => api.snapshot());
check('snapshot मना', !r.ok && r.err.status === 401, emsg(r));

console.log('\n-- खाता / लॉगिन --');
r = await grab(() => api.authStatus());
if (!r.data.isSetup) {
  r = await grab(() => api.setup({ userId: 'chhotelal', password: 'soniji123', question: 'गाँव?', answer: 'खतखरी' }));
  check('setup ok', r.ok && r.data.token, emsg(r));
} else {
  r = await finish2fa(await grab(() => api.login('chhotelal', 'soniji123')));
  check('login ok', r.ok && r.data.token, emsg(r));
}
setToken(r.data.token);
check('टोकन सेव हुआ', Boolean(getToken()));
r = await grab(() => api.me());
check('me', r.ok && r.data.user.name === 'chhotelal', r.data);

console.log('\n-- Google Authenticator (मालिक) --');
{
  let kicked = false;
  setUnauthorizedHandler(() => { kicked = true; });
  r = await grab(() => api.login('chhotelal', 'soniji123'));
  check('login पर token नहीं, दूसरा कदम', r.ok && !r.data.token && ['setup', 'totp'].includes(r.data.step) && r.data.challenge, r.data);
  const first = r;
  if (first.data.step === 'setup') {
    check('पहली बार QR का पता', first.data.otpauthUrl.startsWith('otpauth://totp/'), first.data);
    r = await grab(() => api.twofaSetup(first.data.challenge, '000000'));
    check('गलत कोड: 400, कोशिश बाकी बताए', !r.ok && r.err.status === 400 && r.err.message.includes('कोशिश'), emsg(r));
  }
  r = await finish2fa(first);
  check('कोड से token', r.ok && r.data.token && r.data.role === 'owner', emsg(r));
  if (first.data.step === 'setup') check('setup पर 10 backup codes', r.data.backupCodes.length === 10, r.data);
  setToken(r.data.token);
  r = await grab(() => api.twofaStatus());
  check('2FA status चालू', r.ok && r.data.enabled === true, emsg(r));
  r = await grab(() => api.twofaVerify('a'.repeat(64), '123456'));
  check('समय खत्म वाला challenge: details.code पहुँचा', !r.ok && r.err.status === 401 && r.err.details?.code === 'CHALLENGE_EXPIRED', r.err?.details);
  r = await grab(() => api.twofaNewBackupCodes('000000'));
  check('नए backup codes: गलत कोड -> 400', !r.ok && r.err.status === 400, emsg(r));
  const code = await nextCode();
  r = await grab(() => api.twofaNewBackupCodes(code));
  check('नए backup codes बने', r.ok && r.data.backupCodes.length === 10, emsg(r));
  check('लॉगिन के कदमों पर ऐप लॉगआउट नहीं हुआ', !kicked, kicked);
  setUnauthorizedHandler(null);
}

console.log('\n-- साफ़ शुरुआत --');
await grab(() => api.clearAll());
r = await grab(() => api.snapshot());
const shape = ['rates', 'customers', 'stock', 'invoices', 'offers', 'settings'];
check('snapshot का ढाँचा ऐप जैसा', r.ok && shape.every((k) => k in r.data), r.ok ? Object.keys(r.data) : emsg(r));
check('settings में logoUrl', r.data.settings.logoUrl === '/shreeji.png', r.data.settings.logoUrl);

console.log('\n-- Rates और Settings --');
r = await grab(() => api.saveRates({ gold: 7250, silver: 92 }));
check('rate सेव', r.ok && r.data.gold === 7250, emsg(r));
r = await grab(() => api.saveSettings({ shopPhone: '9131154535', gst: 3, gstin: '23ABCDE1234F1Z5' }));
check('settings सेव', r.ok && r.data.shopPhone === '9131154535', emsg(r));

console.log('\n-- ग्राहक --');
r = await grab(() => api.createCustomer({ name: 'राकेश पटेल', phone: '9827001122', address: 'मौगंज', openingBalance: 3000 }));
check('ग्राहक बना, पुराना बकाया चढ़ा', r.ok && r.data.balance === 3000 && r.data.ledger.length === 1, emsg(r));
const custId = r.data.id;
r = await grab(() => api.createCustomer({ name: '' }));
check('बिना नाम मना', !r.ok && r.err.status === 400, emsg(r));
r = await grab(() => api.updateCustomer(custId, { address: 'गांधी चौक' }));
check('ग्राहक अपडेट, बकाया नहीं बदला', r.ok && r.data.address === 'गांधी चौक' && r.data.balance === 3000, emsg(r));
r = await grab(() => api.addLedger(custId, { amount: -1000, note: 'भुगतान प्राप्त' }));
check('भुगतान से बकाया घटा', r.ok && r.data.balance === 2000, emsg(r));

console.log('\n-- स्टॉक --');
r = await grab(() => api.createStock({ name: 'अंगूठी', category: 'Gold', purity: '22K', weight: 42, qty: 9 }));
check('स्टॉक बना', r.ok && r.data.qty === 9, emsg(r));
const stkId = r.data.id;
r = await grab(() => api.updateStock(stkId, { qty: 10 }));
check('सिर्फ qty बदली, बाकी वैसा ही', r.ok && r.data.qty === 10 && r.data.weight === 42 && r.data.purity === '22K', r.data);

console.log('\n-- बिल (Billing पेज जैसा payload) --');
r = await grab(() => api.createInvoice({
  type: 'sale', gstMode: 'gst', date: new Date().toISOString().slice(0, 10),
  customerId: custId,
  items: [{ name: 'अंगूठी', metal: 'Gold', weight: 8, purity: 91.6, makingType: 'perg', making: 350 }],
  exchange: { weight: 0, purity: 0, deduct: 0, rate: 0 },
  discountType: 'flat', discountValue: 0, gstPct: 3, paid: 30000,
}));
check('बिल बना', r.ok && r.data.total === 57605.84, r.ok ? r.data.total : emsg(r));
const invId = r.data.id;
check('item का हिसाब गोल है', r.data.items[0].metalVal === 53128 && r.data.items[0].itemTotal === 55928, r.data.items[0]);

r = await grab(() => api.snapshot());
let stk = r.data.stock.find((s) => s.id === stkId);
let cust = r.data.customers.find((c) => c.id === custId);
check('बिक्री से स्टॉक अपने आप घटा', stk.qty === 9 && stk.weight === 34, stk);
check('बकाया अपने आप चढ़ा', cust.balance === 29605.84, cust.balance);
check('खाते में बिल की entry', cust.ledger.some((l) => l.invoiceId === invId), cust.ledger);

r = await grab(() => api.recordPayment(invId, 5000, 'नकद'));
check('भुगतान दर्ज', r.ok && r.data.paid === 35000 && r.data.due === 22605.84, emsg(r));
r = await grab(() => api.snapshot());
check('भुगतान से बकाया घटा', r.data.customers.find((c) => c.id === custId).balance === 24605.84,
  r.data.customers.find((c) => c.id === custId).balance);

console.log('\n-- नया ग्राहक बिल से ही बन जाए --');
r = await grab(() => api.createInvoice({
  type: 'sale', gstMode: 'nongst',
  customerName: 'नया ग्राहक', customerPhone: '9000000000',
  items: [{ name: 'चांदी पायल', metal: 'Silver', weight: 100, purity: 92.5, makingType: 'flat', making: 600 }],
  discountType: 'flat', discountValue: 0, paid: 0,
}));
check('walk-in से ग्राहक बना', r.ok && r.data.customerName === 'नया ग्राहक' && r.data.gst === 0, emsg(r));
r = await grab(() => api.snapshot());
check('अब दो ग्राहक', r.data.customers.length === 2, r.data.customers.length);

console.log('\n-- बिल हटाने पर सब उलट जाए --');
r = await grab(() => api.deleteInvoice(invId));
check('बिल हटा', r.ok, emsg(r));
r = await grab(() => api.snapshot());
stk = r.data.stock.find((s) => s.id === stkId);
cust = r.data.customers.find((c) => c.id === custId);
check('स्टॉक वापस पहले जैसा', stk.qty === 10 && stk.weight === 42, stk);
check('बकाया वापस 2000', cust.balance === 2000, cust.balance);

console.log('\n-- ऑफर --');
r = await grab(() => api.createOffer({ title: 'दीपावली छूट', discountPercent: 15, startDate: '2020-01-01', endDate: '2099-01-01', description: '' }));
check('ऑफर बना', r.ok, emsg(r));
const offId = r.data.id;
r = await grab(() => api.updateOffer(offId, { discountPercent: 20 }));
check('ऑफर बदला, title वैसा ही', r.ok && r.data.discountPercent === 20 && r.data.title === 'दीपावली छूट', r.data);
r = await grab(() => api.deleteOffer(offId));
check('ऑफर हटा', r.ok, emsg(r));

console.log('\n-- Backup पेज --');
r = await grab(() => api.snapshot());
const snap = r.data;
r = await grab(() => api.createSnapshot());
check('कॉपी बनी', r.ok && r.data.id, emsg(r));
const snapId = r.data.id;
r = await grab(() => api.listSnapshots());
check('कॉपियों की सूची', r.ok && r.data.some((s) => s.id === snapId), emsg(r));
r = await grab(() => api.clearAll());
check('सब मिटा', r.ok && r.data.counts.customers === 0, emsg(r));
r = await grab(() => api.restoreSnapshot(snapId));
check('कॉपी से वापस आया', r.ok && r.data.counts.customers === 2, emsg(r));
r = await grab(() => api.snapshot());
check('वापसी के बाद बकाया वही', r.data.customers.find((c) => c.id === custId).balance === 2000,
  r.data.customers.map((c) => c.balance));
r = await grab(() => api.clearAll());
r = await grab(() => api.restore(snap));
check('.json से restore', r.ok && r.data.counts.customers === 2, emsg(r));
r = await grab(() => api.seedDemo());
check('demo भरा', r.ok && r.data.counts.invoices === 9, emsg(r));

console.log('\n-- पासवर्ड भूल गए --');
r = await grab(() => api.forgotQuestion('galat'));
check('गलत ID मना', !r.ok && r.err.status === 404, emsg(r));
r = await grab(() => api.forgotQuestion('chhotelal'));
check('सवाल मिला', r.ok && r.data.question === 'गाँव?', emsg(r));
r = await grab(() => api.forgotReset('chhotelal', 'गलत', 'naya1234'));
check('गलत जवाब मना', !r.ok && r.err.status === 401, emsg(r));
r = await grab(() => api.forgotReset('chhotelal', ' खतखरी ', 'naya1234'));
check('सही जवाब पर रीसेट', r.ok, emsg(r));
r = await finish2fa(await grab(() => api.login('chhotelal', 'naya1234')));
check('नए पासवर्ड से लॉगिन', r.ok && r.data.token, emsg(r));
setToken(r.data.token);
// वापस पुराना, ताकि दोबारा चलाया जा सके. पासवर्ड बदलते ही पुराने लॉगिन बंद — नया token मिलता है
r = await grab(() => api.changePassword('naya1234', 'soniji123'));
check('पासवर्ड बदला, नया token मिला', r.ok && r.data.token, emsg(r));
setToken(r.data.token);

console.log('\n-- टोकन गलत हो तो --');
{
  let kicked = false;
  setUnauthorizedHandler(() => { kicked = true; });
  const good = getToken();
  setToken('garbage.token');
  r = await grab(() => api.snapshot());
  check('401 पर ऐप को खबर मिली', !r.ok && r.err.status === 401 && kicked, { kicked, err: emsg(r) });
  setToken(good);
}

console.log('\n-- सर्वर बंद हो तो साफ़ संदेश --');
{
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error('boom'));
  r = await grab(() => api.snapshot());
  check('साफ़ हिंदी संदेश', !r.ok && r.err instanceof ApiError && r.err.message.includes('सर्वर से बात नहीं'), emsg(r));
  globalThis.fetch = realFetch;
}

console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
process.exit(fail ? 1 : 0);
