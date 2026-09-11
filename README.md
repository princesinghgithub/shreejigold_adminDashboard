# Soni Ji Jewellers — बिलिंग सिस्टम (React + Vite)

Single-user jewellery shop billing & management app, converted to a proper React + Vite project.

## चलाने के लिए (Setup)

```bash
npm install
npm run dev
```

फिर ब्राउज़र में जो लोकल पता (जैसे `http://localhost:5173`) दिखे, वो खोलें।

## Production बिल्ड (hosting के लिए)

```bash
npm run build
```

यह `dist/` फ़ोल्डर बनाएगा — इसी फ़ोल्डर को किसी भी static hosting (Netlify, Vercel, Hostinger, cPanel वगैरह) पर अपलोड करना है।

Preview करने के लिए (बिल्ड के बाद):
```bash
npm run preview
```

## PWA (मोबाइल/कंप्यूटर पर ऐप की तरह Install)

बिल्ड में `sw.js` (service worker) और `manifest.webmanifest` अपने आप बनते हैं (`vite-plugin-pwa`, सेटिंग `vite.config.js` में)।

- **Android (Chrome):** साइट खोलें → मेन्यू (⋮) → **Install app / Add to Home screen**
- **iPhone (Safari):** Share बटन → **Add to Home Screen**
- **कंप्यूटर (Chrome/Edge):** पते वाली पट्टी में install (⊕) आइकन

ध्यान रखें:
- Install सिर्फ **HTTPS** पर (या `localhost` पर) होता है। `npm run dev` में service worker बंद रहता है, जाँचने के लिए `npm run build` और फिर `npm run preview` चलाएँ।
- सिर्फ ऐप का ढाँचा cache होता है। बिल, रेट, स्टॉक जैसा डेटा (`/api`) हमेशा सर्वर से ताज़ा आता है, इसलिए बिलिंग के लिए इंटरनेट/backend चालू होना ज़रूरी है।
- नया version deploy करने पर ऐप अगली बार खोलने पर अपने आप नया हो जाता है।
- आइकन `public/icons/` में हैं (लोगो का SG वाला हिस्सा)। लोगो बदलें तो ये भी बदलने होंगे।

## Features

- Password login (केवल Soni Ji के लिए, पहली बार में सेट होता है)
- Gold/Silver rate manual update
- बिक्री/खरीद बिलिंग — एक ही बिल में कई metal/item, GST/Non-GST दोनों तरह के बिल
- हर बिल पर auto-generated barcode
- पुराने सोने का Exchange calculator
- Customer + उधारी ledger
- Stock management (auto adjust)
- Invoice PDF डाउनलोड, Print, WhatsApp पर भेजना
- Daily/Monthly/Custom-range reports + CSV export, customer व GST-mode filter
- Offers record
- Backup/Restore (.json), Demo data seeding
- पूरी तरह Responsive (mobile + desktop)

## डेटा कहाँ सेव होता है

डेटा ब्राउज़र के `localStorage` में सेव होता है — यानी उसी डिवाइस/ब्राउज़र में रहेगा। नियमित रूप से **Backup** सेक्शन से `.json` फाइल डाउनलोड करके सुरक्षित रखें।

अगर भविष्य में सभी डिवाइस पर एक जैसा डेटा (cloud sync) चाहिए, तो एक backend/database (जैसे Firebase, Supabase, या खुद का API) जोड़ना होगा — अभी का structure (`src/context/DataContext.jsx`, `src/lib/storage.js`) उसके लिए आसानी से अपडेट किया जा सकता है, क्योंकि सारा data-access एक ही जगह से होकर गुजरता है।

## Project Structure

```
src/
  lib/           - pure helper functions (formatting, calculations, storage, demo seed)
  context/       - React context: DataContext (shop data), ModalContext, ToastContext, PrintContext
  components/    - reusable UI: Sidebar, Topbar, Login, Logo/BrandDefs, Invoice view/modal/table
  pages/         - one file per sidebar section (Dashboard, Billing, Customers, Stock, Reports, ...)
```
