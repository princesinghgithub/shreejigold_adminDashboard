import { useCallback, useEffect, useState } from 'react';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { api, assetUrl } from '../lib/api';
import { inr } from '../lib/format';

// Website के filter इन्हीं नामों से चलते हैं (shreeji-gold/src/data/catalog.js) —
// यहाँ नया नाम जोड़ें तो वहाँ भी जोड़ें, वरना filter में नहीं दिखेगा
const TYPES = ['Rings', 'Earrings', 'Necklaces', 'Chains', 'Bangles', 'Mangalsutra', 'Nose Pins', 'Pendants', 'Bridal Sets'];
const METALS = ['22K Gold', '18K Gold', 'Rose Gold', 'Diamond', 'Gemstone', 'Silver'];
const WEARERS = ['Women', 'Men', 'Kids'];
const OCCASIONS = ['Daily Wear', 'Office Wear', 'Wedding', 'Festive', 'Gifting'];

/** पुराना design किसी ऐसे नाम का हो जो सूची में नहीं, तो भी select में दिखे */
const withCurrent = (list, current) => (current && !list.includes(current) ? [current, ...list] : list);

/** फोटो छोटी करके JPEG — मोबाइल की 5 MB फोटो ~150 KB रह जाती है, website भी जल्दी खुलती है */
function compressImage(file, maxSide = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('सिर्फ फोटो (JPG / PNG) चुनें'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; // PNG का खाली हिस्सा काला न दिखे
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('यह फोटो खुल नहीं रही — कोई दूसरी चुनें'));
    };
    img.src = url;
  });
}

function ProductForm({ item, onSaved }) {
  const { closeModal } = useModal();
  const toast = useToast();
  const [f, setF] = useState(() => ({
    name: item?.name || '',
    type: item?.type || TYPES[0],
    metal: item?.metal || METALS[0],
    wearer: item?.wearer || 'Women',
    occasion: item?.occasion || OCCASIONS[0],
    price: item?.price || '',
    weight: item?.weight || '',
    description: item?.description || '',
    imageUrl: item?.imageUrl || '',
    active: item ? item.active : true,
    isNew: item ? item.isNew : true,
    bestseller: item ? item.bestseller : false,
  }));
  const [imageData, setImageData] = useState(''); // अभी चुनी गई नई फोटो
  const [removeImage, setRemoveImage] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setF((s) => ({ ...s, [k]: v }));
  };

  const uploaded = item?.hasUpload && !removeImage ? assetUrl(item.image) : '';
  const preview = imageData || uploaded || f.imageUrl;

  async function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setImageData(await compressImage(file));
      setRemoveImage(false);
    } catch (err) { toast(err.message); }
  }

  function clearPhoto() {
    setImageData('');
    setRemoveImage(true);
    setF((s) => ({ ...s, imageUrl: '' }));
  }

  async function save() {
    if (busy) return;
    if (!f.name.trim()) { toast('Design का नाम डालें'); return; }
    const body = { ...f, name: f.name.trim(), price: Number(f.price) || 0, weight: Number(f.weight) || 0 };
    if (imageData) body.imageData = imageData;
    else if (removeImage && item?.hasUpload) body.removeImage = true;

    setBusy(true);
    try {
      if (item) await api.updateCatalogItem(item.id, body);
      else await api.createCatalogItem(body);
      toast('Design Save हो गया ✔ — website पर 1 मिनट में दिखेगा');
      closeModal();
      onSaved();
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="modal-head">
        <h3>{item ? 'Design Edit करें' : 'नया Design (Website)'}</h3>
        <button className="modal-close" onClick={closeModal}>✕</button>
      </div>

      <div className="field"><label>Design का नाम (website पर यही दिखेगा)</label>
        <input value={f.name} onChange={set('name')} placeholder="जैसे — Temple Jhumka 22K" /></div>

      <div className="field"><label>फोटो</label>
        <div className="img-pick">
          {preview ? <img className="img-preview" src={preview} alt="" /> : <div className="img-preview">फोटो नहीं</div>}
          <div>
            <input type="file" accept="image/*" onChange={pickFile} />
            <p className="small-note">मोबाइल से खींची फोटो भी चलेगी — अपने आप छोटी हो जाती है।</p>
            {preview && <button type="button" className="icon-btn" onClick={clearPhoto}>फोटो हटाएं</button>}
          </div>
        </div>
      </div>
      {!imageData && !uploaded && (
        <div className="field"><label>या फोटो का link (optional)</label>
          <input value={f.imageUrl} onChange={set('imageUrl')} placeholder="https://..." /></div>
      )}

      <div className="grid grid-2">
        <div className="field"><label>Type</label>
          <select value={f.type} onChange={set('type')}>{withCurrent(TYPES, f.type).map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="field"><label>Metal / Stone</label>
          <select value={f.metal} onChange={set('metal')}>{withCurrent(METALS, f.metal).map((t) => <option key={t}>{t}</option>)}</select></div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>किसके लिए</label>
          <select value={f.wearer} onChange={set('wearer')}>{withCurrent(WEARERS, f.wearer).map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="field"><label>मौका (Occasion)</label>
          <select value={f.occasion} onChange={set('occasion')}>{withCurrent(OCCASIONS, f.occasion).map((t) => <option key={t}>{t}</option>)}</select></div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>कीमत ₹ (खाली = website पर &quot;आज का रेट पूछें&quot;)</label>
          <input type="number" min="0" value={f.price} onChange={set('price')} /></div>
        <div className="field"><label>वजन ग्राम (optional)</label>
          <input type="number" min="0" step="0.001" value={f.weight} onChange={set('weight')} /></div>
      </div>
      <div className="field"><label>जानकारी (optional)</label>
        <textarea rows={2} value={f.description} onChange={set('description')} /></div>

      <div className="check-row">
        <label><input type="checkbox" checked={f.active} onChange={set('active')} /> Website पर दिखाएं</label>
        <label><input type="checkbox" checked={f.isNew} onChange={set('isNew')} /> NEW IN</label>
        <label><input type="checkbox" checked={f.bestseller} onChange={set('bestseller')} /> Our Pick (होम पेज पर)</label>
      </div>

      <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Save हो रहा है…' : 'Save करें'}</button>
    </div>
  );
}

export default function Catalog() {
  const { openModal } = useModal();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.listCatalog());
      setErr('');
    } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(p) {
    if (!window.confirm(`"${p.name}" website से हटाएं?`)) return;
    try {
      await api.deleteCatalogItem(p.id);
      toast('Design हटाया गया');
      load();
    } catch (e) { toast(e.message); }
  }

  async function toggleActive(p) {
    try {
      await api.updateCatalogItem(p.id, { active: !p.active });
      toast(p.active ? 'Website से छिपा दिया' : 'Website पर दिखने लगा ✔');
      load();
    } catch (e) { toast(e.message); }
  }

  async function restoreDefaults() {
    if (!window.confirm('Website के पहले से बने designs में से जो इस सूची में नहीं हैं (जैसे गलती से हटाए हुए), वो वापस जुड़ जाएंगे। आपके डाले या बदले designs वैसे ही रहेंगे। जारी रखें?')) return;
    setRestoring(true);
    try {
      const r = await api.importWebsiteCatalog();
      toast(r.added ? `${r.added} पुराने designs वापस जुड़े ✔` : 'सारे पुराने designs पहले से मौजूद हैं');
      load();
    } catch (e) {
      toast(e.message);
    } finally {
      setRestoring(false);
    }
  }

  const all = items || [];
  const shown = all.filter((p) => p.active).length;
  const term = q.trim().toLowerCase();
  const visible = all.filter((p) => (!typeFilter || p.type === typeFilter)
    && (!term || `${p.name} ${p.id} ${p.metal} ${p.occasion}`.toLowerCase().includes(term)));
  const types = withCurrent(TYPES, '').concat(all.map((p) => p.type).filter((t) => t && !TYPES.includes(t)));

  return (
    <div className="card">
      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        Website Catalog
        <span className="row-actions" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-outline" style={{ padding: '7px 12px', fontSize: 12.5 }} disabled={restoring} onClick={restoreDefaults}>
            {restoring ? 'जोड़ रहे हैं…' : '↺ पुराने designs वापस लाएं'}
          </button>
          <button className="btn btn-gold" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => openModal(<ProductForm onSaved={load} />)}>
            + नया Design
          </button>
        </span>
      </h3>
      <p className="small-note" style={{ marginTop: 0, marginBottom: 12 }}>
        यहाँ के designs दुकान की website पर दिखते हैं — कुल {all.length}, जिनमें {shown} दिख रहे हैं। नया design सबसे ऊपर
        आता है। कीमत खाली छोड़ें तो website पर &quot;आज का रेट पूछें&quot; दिखेगा। Website का gold rate &quot;आज का Rate&quot; पेज से आता है।
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          style={{ flex: '1 1 220px' }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Design का नाम या नंबर खोजें…"
        />
        <select style={{ flex: '0 1 180px' }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">सारे Type</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      {err && <p className="err">{err}</p>}

      <div className="tbl-wrap">
        <table>
          <tbody>
            <tr><th>फोटो</th><th>Design</th><th>Type · Metal</th><th>कीमत</th><th>Website</th><th></th></tr>
            {items === null ? (
              <tr><td colSpan={6} className="empty">लोड हो रहा है…</td></tr>
            ) : visible.length ? visible.map((p) => (
              <tr key={p.id}>
                <td>{p.image ? <img className="thumb" src={assetUrl(p.image)} alt="" loading="lazy" /> : <div className="thumb">💍</div>}</td>
                <td>
                  <b>{p.name}</b>
                  {p.isNew && <span className="tag-inline">NEW</span>}
                  {p.bestseller && <span className="tag-inline">PICK</span>}
                  <div className="small-note" style={{ marginTop: 2 }}>{p.id}</div>
                </td>
                <td>{p.type} · {p.metal}</td>
                <td>{p.price ? inr(p.price) : <span className="small-note">रेट पूछें</span>}</td>
                <td><span className={'badge ' + (p.active ? 'badge-paid' : 'badge-hidden')}>{p.active ? 'दिख रहा' : 'छिपा'}</span></td>
                <td className="row-actions">
                  <button className="icon-btn" onClick={() => openModal(<ProductForm item={p} onSaved={load} />)}>Edit</button>
                  <button className="icon-btn" onClick={() => toggleActive(p)}>{p.active ? 'छिपाएं' : 'दिखाएं'}</button>
                  <button className="icon-btn" onClick={() => remove(p)}>हटाएं</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="empty">
                {all.length
                  ? 'इस खोज से कोई design नहीं मिला'
                  : 'अभी कोई design नहीं — "+ नया Design" से जोड़ें, या "↺ पुराने designs वापस लाएं" से website के पहले वाले designs डालें।'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
