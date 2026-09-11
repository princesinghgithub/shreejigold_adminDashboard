import { useCallback, useEffect, useState } from 'react';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';

const LEAD_STATUS = [
  { id: 'new', label: 'नई' },
  { id: 'contacted', label: 'बात हुई' },
  { id: 'converted', label: 'बिक्री हुई' },
  { id: 'closed', label: 'बंद' },
];

function fmtWhen(iso) {
  const d = new Date(iso);
  return fmtDate(d) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function waLink(lead) {
  const about = lead.productName
    ? ` Aapne website par "${lead.productName}" ke baare me poocha tha.`
    : ' Aapne website par sampark kiya tha.';
  // wa.me का redirect emoji तोड़ देता है — सीधा api.whatsapp.com, और बिना emoji
  const text = `Namaste ${lead.name} ji, Shreeji Gold se bol rahe hain.${about}`;
  return `https://api.whatsapp.com/send?phone=91${lead.phone}&text=${encodeURIComponent(text)}`;
}

// Sidebar का badge इसी से ताज़ा होता है
const notifyChanged = () => window.dispatchEvent(new Event('leads-changed'));

function NoteForm({ lead, onSaved }) {
  const { closeModal } = useModal();
  const toast = useToast();
  const [notes, setNotes] = useState(lead.notes || '');

  async function save() {
    try {
      await api.updateLead(lead.id, { notes });
      toast('Note सेव हो गया ✔');
      closeModal();
      onSaved();
    } catch (e) { toast(e.message); }
  }

  return (
    <div>
      <div className="modal-head"><h3>{lead.name} — Note</h3><button className="modal-close" onClick={closeModal}>✕</button></div>
      <div className="field"><label>क्या बात हुई, कब आएंगे, बजट…</label>
        <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <button className="btn btn-primary" onClick={save}>Save करें</button>
    </div>
  );
}

export default function Leads() {
  const { openModal } = useModal();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.listLeads(status));
      setErr('');
    } catch (e) { setErr(e.message); }
  }, [status]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60 * 1000); // नई enquiry अपने आप दिखे
    return () => clearInterval(t);
  }, [load]);

  async function changeStatus(lead, next) {
    try {
      await api.updateLead(lead.id, { status: next });
      load();
      notifyChanged();
    } catch (e) { toast(e.message); }
  }

  async function remove(lead) {
    if (!window.confirm(`${lead.name} (${lead.phone}) की lead हटाएं?`)) return;
    try {
      await api.deleteLead(lead.id);
      toast('Lead हटाई गई');
      load();
      notifyChanged();
    } catch (e) { toast(e.message); }
  }

  const counts = data?.counts || {};
  const tabs = [{ id: '', label: 'सभी', n: counts.total }, ...LEAD_STATUS.map((s) => ({ ...s, n: counts[s.id] }))];

  return (
    <div className="card">
      <h3>Website Leads</h3>
      <p className="small-note" style={{ marginTop: 0, marginBottom: 12 }}>
        Website पर किसी design पर &quot;Enquire&quot; या WhatsApp बटन से नाम-नंबर देने वाले लोग यहाँ आते हैं।
        Call / WhatsApp करें और status बदलते रहें। सूची हर मिनट अपने आप ताज़ा होती है।
      </p>

      <div className="status-tabs">
        {tabs.map((t) => (
          <button key={t.id || 'all'} className={'status-tab' + (status === t.id ? ' active' : '')} onClick={() => setStatus(t.id)}>
            {t.label}{t.n != null ? ` (${t.n})` : ''}
          </button>
        ))}
      </div>
      {err && <p className="err">{err}</p>}

      <div className="tbl-wrap">
        <table>
          <tbody>
            <tr><th>कब</th><th>ग्राहक</th><th>किस बारे में</th><th>Status</th><th></th></tr>
            {data === null ? (
              <tr><td colSpan={5} className="empty">लोड हो रहा है…</td></tr>
            ) : data.leads.length ? data.leads.map((l) => (
              <tr key={l.id}>
                <td className="lead-when">{fmtWhen(l.createdAt)}</td>
                <td>
                  <b>{l.name}</b>
                  <div><a href={`tel:+91${l.phone}`}>{l.phone}</a></div>
                </td>
                <td>
                  {l.productName
                    ? <div>💍 {l.productName}</div>
                    : <div className="small-note" style={{ marginTop: 0 }}>{l.source === 'widget' ? 'WhatsApp बटन से' : 'Website से'}</div>}
                  {l.message && <div className="lead-msg">{l.message}</div>}
                  {l.notes && <div className="lead-note">📝 {l.notes}</div>}
                </td>
                <td>
                  <select className={'badge badge-' + l.status} value={l.status} onChange={(e) => changeStatus(l, e.target.value)}>
                    {LEAD_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </td>
                <td className="row-actions">
                  <a className="icon-btn" href={`tel:+91${l.phone}`}>📞 Call</a>
                  <a className="icon-btn wa-btn" href={waLink(l)} target="_blank" rel="noreferrer">WhatsApp</a>
                  <button className="icon-btn" onClick={() => openModal(<NoteForm lead={l} onSaved={load} />)}>Note</button>
                  <button className="icon-btn" onClick={() => remove(l)}>हटाएं</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="empty">
                {status ? 'इस status में कोई lead नहीं' : 'अभी कोई lead नहीं आई — website पर enquiry आते ही यहाँ दिखेगी'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
