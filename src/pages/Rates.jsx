import { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useModal } from '../context/ModalContext';
import { fmtDate, todayStr, genBarcode } from '../lib/format';
import { api } from '../lib/api';
import InvoiceModal from '../components/InvoiceModal';
import LoginSettings from '../components/LoginSettings';

// Settings में जो भी field दिखानी है, उसे यहाँ जोड़ दें — फॉर्म अपने आप बन जाता है
const SHOP_FIELDS = [
  { key: 'shopNameHindi', label: 'दुकान का नाम (हिंदी — बिल पर बड़े अक्षरों में)' },
  { key: 'shopName', label: 'दुकान का नाम (English)' },
  { key: 'logoUrl', label: 'लोगो फाइल का पता (public फोल्डर में रखें)' },
  { key: 'nameSuffix', label: 'नाम के आगे (जैसे "एण्ड सन्स")' },
  { key: 'blessing', label: 'सबसे ऊपर की पंक्ति (जैसे ॥ श्री हरि कृपा ॥)' },
  { key: 'tagline', label: 'दुकान की पंक्ति (tagline)' },
  { key: 'propName', label: 'प्रोपराइटर का नाम' },
  { key: 'shopAddress', label: 'पता' },
  { key: 'shopPhone', label: 'फ़ोन नंबर' },
  { key: 'shopPhone2', label: 'दूसरा नंबर (Cell)' },
  { key: 'gstin', label: 'GSTIN नंबर' },
  { key: 'jurisdiction', label: 'न्याय क्षेत्र (Jurisdiction — जैसे Mauganj)' },
  { key: 'categories', label: 'लाल पट्टी में क्या लिखा हो' },
  { key: 'hsn', label: 'HSN कोड (गहनों के लिए आम तौर पर 7113)' },
  { key: 'hallmarkLabel', label: 'आइटम के नीचे लिखा शब्द (जैसे Hallmark)' },
  { key: 'footerNote', label: 'नीचे की चेतावनी' },
  { key: 'websiteUrl', label: 'दुकान की Website का पता — भरने पर बिल पर QR छपेगा, ग्राहक स्कैन करके बिल जाँच सकेगा (जैसे https://shreejigold.shop)' },
  { key: 'upiId', label: 'UPI ID — हर बिल पर इसी का भुगतान QR छपेगा (खाली छोड़ें तो QR नहीं छपेगा)' },
  { key: 'upiName', label: 'UPI पर दिखने वाला नाम (जैसे Dhirendra Soni)' },
];

export default function Rates() {
  const { db, mutate } = useData();
  const toast = useToast();
  const { openModal } = useModal();

  const [gold, setGold] = useState(db.rates.gold || '');
  const [silver, setSilver] = useState(db.rates.silver || '');
  const [gst, setGst] = useState(db.settings.gst);
  const [shop, setShop] = useState(() => ({ ...db.settings }));
  // दुकान की settings सिर्फ मालिक / Admin बदल सकते हैं (सर्वर भी staff को रोकता है)
  const [canEditShop, setCanEditShop] = useState(false);

  useEffect(() => {
    let alive = true;
    api.me()
      .then((r) => { if (alive) setCanEditShop(['owner', 'admin'].includes(r.user.role)); })
      .catch(() => { /* पता न चले तो फॉर्म छिपा रहे */ });
    return () => { alive = false; };
  }, []);

  function set(key, value) {
    setShop((s) => ({ ...s, [key]: value }));
  }

  async function saveRates() {
    try {
      await mutate(() => api.saveRates({ gold: Number(gold) || 0, silver: Number(silver) || 0 }));
      toast('Rate अपडेट हो गया ✔');
    } catch (e) { toast(e.message); }
  }

  async function saveSettings() {
    try {
      await mutate(() => api.saveSettings({ ...shop, gst: Number(gst) || 0 }));
      toast('Settings Save हो गईं ✔');
    } catch (e) { toast(e.message); }
  }

  // असली बिल छापे बिना डिज़ाइन देख लें
  function previewBill() {
    const rate = Number(gold) || 7250;
    const srate = Number(silver) || 92;
    const mk = (name, metal, weight, purity, makingType, makingRate, extra = {}) => {
      const r = (metal === 'Gold' ? rate : srate) * (purity / 100);
      const metalVal = weight * r;
      const m = makingType === 'perg' ? makingRate * weight
        : makingType === 'pct' ? metalVal * (makingRate / 100) : makingRate;
      const hallmark = extra.hallmark || 0;
      return {
        name, metal, huid: '', grossWeight: weight, weight, purity, rate: r,
        makingType, makingRate, making: m, hallmark, metalVal, itemTotal: metalVal + m + hallmark, ...extra,
      };
    };
    const items = [
      mk('हार (Haar)', 'Gold', 19.835, 91.6, 'pct', 11, { huid: 'VGXVXH', grossWeight: 20.41, hallmark: 45 }),
      mk('अंगूठी (Ladies ring)', 'Gold', 4.569, 91.6, 'pct', 11, { huid: 'FCVFJ5', hallmark: 45 }),
      mk('टॉप्स झुमकी', 'Gold', 11.407, 91.6, 'perg', 400, { huid: 'IUGU84', grossWeight: 11.62, hallmark: 45 }),
      mk('चांदी पायल', 'Silver', 120, 92.5, 'flat', 600),
    ];
    const subtotal = items.reduce((s, i) => s + i.metalVal, 0);
    const making = items.reduce((s, i) => s + i.making, 0);
    const hallmark = items.reduce((s, i) => s + i.hallmark, 0);
    const discount = Math.round((subtotal + making + hallmark) * 0.02);
    const afterDisc = subtotal + making + hallmark - discount;
    const gstPct = Number(gst) || 0;
    const gstAmt = afterDisc * (gstPct / 100);
    const exact = afterDisc + gstAmt;
    const total = Math.round(exact);
    const cash = Math.round(total * 0.3);
    const upi = Math.round(total * 0.3);
    const inv = {
      id: 'inv_preview', billNo: '257', type: 'sale', gstMode: 'gst', barcode: genBarcode(), date: todayStr(),
      createdAt: new Date().toISOString(),
      customerName: 'नमूना ग्राहक', customerPhone: '9876543210',
      customerAddress: 'मौगंज, मध्य प्रदेश', customerPan: 'ABCDE1234F',
      items, exchange: { weight: 0, purity: 0, deduct: 0, rate: 0, value: 0 },
      subtotal, making, hallmark, discount, gstPct, gst: gstAmt, roundOff: total - exact,
      total, paid: cash + upi, due: total - cash - upi,
      payments: [{ mode: 'cash', amount: cash }, { mode: 'upi', amount: upi }],
    };
    openModal(<InvoiceModal inv={inv} settings={{ ...shop, gst: gstPct }} />, true);
  }

  return (
    <div>
      <div className="card" style={{ maxWidth: 480 }}>
        <h3>आज का Rate अपडेट करें</h3>
        <div className="field"><label>Gold Rate (₹ प्रति ग्राम, 24K/999)</label><input type="number" value={gold} onChange={(e) => setGold(e.target.value)} /></div>
        <div className="field"><label>Silver Rate (₹ प्रति ग्राम)</label><input type="number" value={silver} onChange={(e) => setSilver(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={saveRates}>Rate Save करें</button>
        <p className="small-note">आखिरी अपडेट: {db.rates.updatedAt ? fmtDate(db.rates.updatedAt) + ' ' + new Date(db.rates.updatedAt).toLocaleTimeString('en-IN') : 'अभी तक नहीं'}</p>
      </div>

      {canEditShop ? (
        <div className="card">
          <h3>बिल और दुकान की Settings</h3>
          <p className="small-note" style={{ marginTop: 0 }}>
            यहाँ जो भरेंगे वही हर बिल पर छपेगा — नाम, पता, नंबर, GSTIN, शर्तें, सब कुछ.
          </p>
          <div className="field" style={{ maxWidth: 240 }}>
            <label>Default GST %</label>
            <input type="number" value={gst} onChange={(e) => setGst(e.target.value)} />
          </div>
          <div className="settings-grid">
            {SHOP_FIELDS.map((f) => (
              <div className="field" key={f.key}>
                <label>{f.label}</label>
                <input type="text" value={shop[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="field" style={{ maxWidth: 300 }}>
            <label>छपाई का डिज़ाइन</label>
            <select value={shop.billTemplate || 'slip'} onChange={(e) => set('billTemplate', e.target.value)}>
              <option value="slip">प्रीमियम स्लिप (लोगो + लाल पट्टी)</option>
              <option value="simple">सादा बिल</option>
            </select>
          </div>
          <div className="row-actions">
            <button className="btn btn-primary" onClick={saveSettings}>Settings Save करें</button>
            <button className="btn btn-outline" onClick={previewBill}>बिल का नमूना देखें</button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 480 }}>
          <h3>बिल और दुकान की Settings</h3>
          <p className="small-note" style={{ marginTop: 0 }}>
            दुकान का नाम, पता, नंबर, GST और बिल की छपाई सिर्फ मालिक या Admin बदल सकते हैं।
          </p>
          <button className="btn btn-outline" onClick={previewBill}>बिल का नमूना देखें</button>
        </div>
      )}

      <LoginSettings />
    </div>
  );
}
