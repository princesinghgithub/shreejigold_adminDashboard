import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';

function StockForm({ item }) {
  const { mutate } = useData();
  const { closeModal } = useModal();
  const toast = useToast();
  const [name, setName] = useState(item?.name || '');
  const [category, setCategory] = useState(item?.category || 'Gold');
  const [purity, setPurity] = useState(item?.purity || '22K');
  const [weight, setWeight] = useState(item?.weight ?? '');
  const [qty, setQty] = useState(item?.qty ?? 1);

  async function save() {
    if (!name.trim()) { toast('Item नाम डालें'); return; }
    const data = { name: name.trim(), category, purity: purity.trim(), weight: Number(weight) || 0, qty: Number(qty) || 0 };
    try {
      await mutate(() => (item ? api.updateStock(item.id, data) : api.createStock(data)));
      toast('Stock Save हो गया ✔');
      closeModal();
    } catch (e) { toast(e.message); }
  }

  return (
    <div>
      <div className="modal-head"><h3>{item ? 'Item Edit करें' : 'नया Stock Item'}</h3><button className="modal-close" onClick={closeModal}>✕</button></div>
      <div className="field"><label>Item नाम (जैसे — चूड़ी, अंगूठी)</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="grid grid-2">
        <div className="field"><label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>Gold</option><option>Silver</option><option>Other</option>
          </select>
        </div>
        <div className="field"><label>Purity</label><input value={purity} onChange={(e) => setPurity(e.target.value)} placeholder="जैसे 22K / 92.5%" /></div>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>कुल वजन (ग्राम)</label><input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
        <div className="field"><label>Qty (नग)</label><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
      </div>
      <button className="btn btn-primary" onClick={save}>Save करें</button>
    </div>
  );
}

export default function Stock() {
  const { db, mutate } = useData();
  const { openModal } = useModal();
  const toast = useToast();

  async function deleteStock(id) {
    try {
      await mutate(() => api.deleteStock(id));
      toast('Item हटाया गया');
    } catch (e) { toast(e.message); }
  }

  return (
    <div className="card">
      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Stock List
        <button className="btn btn-gold" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => openModal(<StockForm />)}>+ नया Item</button>
      </h3>
      <div className="tbl-wrap">
        <table>
          <tbody>
            <tr><th>Item</th><th>Category</th><th>Purity</th><th>वजन (कुल g)</th><th>Qty (नग)</th><th></th></tr>
            {db.stock.length ? db.stock.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.category}</td><td>{s.purity}</td><td>{s.weight}</td><td>{s.qty}</td>
                <td className="row-actions">
                  <button className="icon-btn" onClick={() => openModal(<StockForm item={s} />)}>Edit</button>
                  <button className="icon-btn" onClick={() => deleteStock(s.id)}>हटाएं</button>
                </td>
              </tr>
            )) : <tr><td colSpan={6} className="empty">Stock खाली है</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
