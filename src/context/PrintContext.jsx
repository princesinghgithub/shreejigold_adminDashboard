import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import jsPDF from 'jspdf';
import InvoiceView from '../components/InvoiceView';
import InvoiceSlip from '../components/InvoiceSlip';
import { billNoOf } from '../lib/bill';

const PrintContext = createContext(null);

// A4 की चौड़ाई (96 DPI पर) — PDF के लिए बिल इसी चौड़ाई में बनता है, ताकि हर स्क्रीन पर एक जैसा आए
const A4_PX = 794;

/**
 * बिल की PDF — बिल को browser में ही तस्वीर बनाकर A4 पन्ने पर रखते हैं.
 * jsPDF का अपना text वाला तरीका हिंदी अक्षर और ₹ नहीं छाप पाता था (सब टूटकर कचरा बनता था,
 * barcode भी गायब). तस्वीर में बिल ठीक वैसा ही आता है जैसा स्क्रीन पर दिखता है.
 * बिल एक पन्ने से लंबा हो तो अगले पन्नों पर चलता है.
 */
async function saveAsPdf(el, fileName) {
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });

  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 8;
  const pageW = 210 - margin * 2;
  const pageH = 297 - margin * 2;
  const imgH = (canvas.height * pageW) / canvas.width;
  const img = canvas.toDataURL('image/jpeg', 0.92);

  for (let y = 0; y < imgH - 1; y += pageH) {
    if (y > 0) doc.addPage();
    doc.addImage(img, 'JPEG', margin, margin - y, pageW, imgH);
    // किनारे साफ़ — पिछले/अगले पन्ने का हिस्सा margin में न झाँके
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, margin, 'F');
    doc.rect(0, 297 - margin, 210, margin, 'F');
  }
  doc.save(fileName);
}

export function PrintProvider({ children }) {
  // { inv, settings, mode: 'print'|'pdf', template: 'slip'|'simple' }
  const [target, setTarget] = useState(null);
  const areaRef = useRef(null);

  useEffect(() => {
    if (!target) return undefined;
    // barcode और लोगो बन जाएँ, फिर छापें
    const timer = setTimeout(() => {
      if (target.mode === 'print') {
        window.print();
        setTimeout(() => setTarget(null), 400);
      } else if (target.mode === 'pdf') {
        saveAsPdf(areaRef.current, 'Bill_' + billNoOf(target.inv) + '_' + target.inv.date + '.pdf')
          .catch((err) => {
            console.error('[pdf]', err);
            window.alert('PDF नहीं बन सकी — Print दबाकर "Save as PDF" चुनें');
          })
          .finally(() => setTarget(null));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [target]);

  function pick(inv, settings, template) {
    return template || settings.billTemplate || 'slip';
  }
  function requestPrint(inv, settings, template) {
    setTarget({ inv, settings, mode: 'print', template: pick(inv, settings, template) });
  }
  function requestPdf(inv, settings, template) {
    setTarget({ inv, settings, mode: 'pdf', template: pick(inv, settings, template) });
  }

  // PDF के समय बिल A4 चौड़ाई में, ऐप के पीछे बनता है (दिखता नहीं); print के समय CSS संभालता है
  const areaStyle = target && target.mode === 'pdf'
    ? { display: 'block', position: 'absolute', left: 0, top: 0, width: A4_PX, zIndex: -1 }
    : { display: target ? 'block' : 'none' };

  return (
    <PrintContext.Provider value={{ requestPrint, requestPdf }}>
      {children}
      {/* छपाई वाला हिस्सा असली ब्राउज़र में ही बनता है */}
      {typeof document !== 'undefined' && createPortal(
        <div id="invoicePrintArea" ref={areaRef} style={areaStyle}>
          {target && (target.template === 'simple'
            ? <InvoiceView inv={target.inv} settings={target.settings} />
            : <InvoiceSlip inv={target.inv} settings={target.settings} />)}
        </div>,
        document.body,
      )}
    </PrintContext.Provider>
  );
}

export function usePrint() {
  const ctx = useContext(PrintContext);
  if (!ctx) throw new Error('usePrint must be used within PrintProvider');
  return ctx;
}
