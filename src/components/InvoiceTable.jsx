import { fmtDate, inr } from '../lib/format';
import { useModal } from '../context/ModalContext';
import { useData } from '../context/DataContext';
import InvoiceModal from './InvoiceModal';

export default function InvoiceTable({ list, showTypeCol = true }) {
  const { openModal } = useModal();
  const { db } = useData();

  if (!list.length) return <div className="empty">कोई बिल नहीं मिला</div>;

  return (
    <div className="tbl-wrap">
      <table>
        <tbody>
          <tr>
            <th>तारीख</th>
            {showTypeCol && <th>Type</th>}
            <th>बिल प्रकार</th>
            <th>Customer</th>
            <th>कुल राशि</th>
            <th>Status</th>
            <th></th>
          </tr>
          {list.map((i) => (
            <tr key={i.id}>
              <td>{fmtDate(i.date)}</td>
              {showTypeCol && (
                <td><span className={'badge badge-' + i.type}>{i.type === 'sale' ? 'बिक्री' : 'खरीद'}</span></td>
              )}
              <td>{i.gstMode === 'nongst' ? <span className="tag-inline">Non-GST</span> : <span className="tag-inline">GST</span>}</td>
              <td>{i.customerName}</td>
              <td>{inr(i.total)}</td>
              <td>{i.due > 0 ? <span className="badge badge-due">बाकी {inr(i.due)}</span> : <span className="badge badge-paid">Clear</span>}</td>
              <td><button className="icon-btn" onClick={() => openModal(<InvoiceModal inv={i} settings={db.settings} />, true)}>देखें</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
