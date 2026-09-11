import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { fmtDate, todayStr } from '../lib/format';
import { api } from '../lib/api';

function OfferForm({ offer }) {
  const { mutate } = useData();
  const { closeModal } = useModal();
  const toast = useToast();
  const [title, setTitle] = useState(offer?.title || '');
  const [discountPercent, setDiscountPercent] = useState(offer?.discountPercent ?? 0);
  const [startDate, setStartDate] = useState(offer?.startDate || todayStr());
  const [endDate, setEndDate] = useState(offer?.endDate || '');
  const [description, setDescription] = useState(offer?.description || '');

  async function save() {
    if (!title.trim()) { toast('Title डालें'); return; }
    const data = { title: title.trim(), discountPercent: Number(discountPercent) || 0, startDate, endDate, description: description.trim() };
    try {
      await mutate(() => (offer ? api.updateOffer(offer.id, data) : api.createOffer(data)));
      toast('Offer Save हो गया ✔');
      closeModal();
    } catch (e) { toast(e.message); }
  }

  return (
    <div>
      <div className="modal-head"><h3>{offer ? 'Offer Edit करें' : 'नया Offer'}</h3><button className="modal-close" onClick={closeModal}>✕</button></div>
      <div className="field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="grid grid-3">
        <div className="field"><label>Discount %</label><input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} /></div>
        <div className="field"><label>Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div className="field"><label>End Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>
      <div className="field"><label>विवरण</label><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <button className="btn btn-primary" onClick={save}>Save करें</button>
    </div>
  );
}

export default function Offers() {
  const { db, mutate } = useData();
  const { openModal } = useModal();
  const toast = useToast();

  async function deleteOffer(id) {
    try {
      await mutate(() => api.deleteOffer(id));
      toast('Offer हटाया गया');
    } catch (e) { toast(e.message); }
  }

  return (
    <div className="card">
      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Offers
        <button className="btn btn-gold" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => openModal(<OfferForm />)}>+ नया Offer</button>
      </h3>
      <div className="tbl-wrap">
        <table>
          <tbody>
            <tr><th>Title</th><th>Discount</th><th>शुरू</th><th>खत्म</th><th>विवरण</th><th></th></tr>
            {db.offers.length ? db.offers.map((o) => (
              <tr key={o.id}>
                <td>{o.title}</td><td>{o.discountPercent}%</td>
                <td>{o.startDate ? fmtDate(o.startDate) : '-'}</td><td>{o.endDate ? fmtDate(o.endDate) : '-'}</td>
                <td>{o.description || '-'}</td>
                <td className="row-actions">
                  <button className="icon-btn" onClick={() => openModal(<OfferForm offer={o} />)}>Edit</button>
                  <button className="icon-btn" onClick={() => deleteOffer(o.id)}>हटाएं</button>
                </td>
              </tr>
            )) : <tr><td colSpan={6} className="empty">कोई Offer दर्ज नहीं</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
