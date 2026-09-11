import { useEffect, useState } from 'react';
import { LogoIcon } from './Logo';
import { api } from '../lib/api';

// adminOnly — सिर्फ मालिक / Admin को दिखे (Staff को नहीं)
const NAV_ITEMS = [
  { id: 'dashboard', icon: '🏠', label: 'डैशबोर्ड' },
  { id: 'rates', icon: '📈', label: 'आज का Rate' },
  { id: 'billing', icon: '🧾', label: 'बिलिंग' },
  { id: 'exchange', icon: '♻️', label: 'पुराना सोना Exchange' },
  { id: 'customers', icon: '👤', label: 'Customer / उधारी' },
  { id: 'stock', icon: '📦', label: 'Stock' },
  { id: 'reports', icon: '📊', label: 'Reports' },
  { id: 'offers', icon: '🎁', label: 'Offers' },
  { id: 'catalog', icon: '💍', label: 'Website Catalog' },
  { id: 'leads', icon: '📩', label: 'Website Leads' },
  { id: 'users', icon: '👥', label: 'Users / Staff', adminOnly: true },
  { id: 'backup', icon: '💾', label: 'Backup', adminOnly: true },
];

const ROLE_LABEL = { owner: 'मालिक', admin: 'Admin', staff: 'Staff' };

/** नई (जिनसे अभी बात नहीं हुई) website leads की गिनती — हर मिनट, और Leads पेज पर बदलाव होते ही */
function useNewLeadCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => api.listLeads('new')
      .then((d) => { if (alive) setCount(d.counts.new || 0); })
      .catch(() => { /* न मिले तो badge बस नहीं दिखेगा */ });
    load();
    const t = setInterval(load, 60 * 1000);
    window.addEventListener('leads-changed', load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener('leads-changed', load);
    };
  }, []);
  return count;
}

export default function Sidebar({ view, setView, onLogout, me }) {
  const newLeads = useNewLeadCount();
  const isAdmin = Boolean(me && (me.role === 'owner' || me.role === 'admin'));
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="sidebar">
      <div className="brand">
        <div className="crest"><LogoIcon round /></div>
        <div><span className="name">Shreeji Gold</span><span className="sub">बिलिंग सिस्टम</span></div>
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          className={'nav-btn' + (view === item.id ? ' active' : '')}
          onClick={() => setView(item.id)}
        >
          <span className="ic">{item.icon}</span> {item.label}
          {item.id === 'leads' && newLeads > 0 && <span className="nav-badge">{newLeads}</span>}
        </button>
      ))}
      <div className="sidebar-foot">
        {me && (
          <div className="sidebar-user">
            👤 {me.name || me.sub}
            <span>{ROLE_LABEL[me.role] || me.role}</span>
          </div>
        )}
        <button className="nav-btn" onClick={onLogout}><span className="ic">🚪</span> लॉगआउट</button>
      </div>
    </div>
  );
}
