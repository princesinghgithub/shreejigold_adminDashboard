import { useCallback, useEffect, useState } from 'react';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';

const ROLE_LABEL = { owner: 'मालिक', admin: 'Admin', staff: 'Staff' };

function whenLabel(iso) {
  if (!iso) return 'अभी तक नहीं';
  const d = new Date(iso);
  return fmtDate(d) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/** नया user (register) या पुराना बदलना */
function UserForm({ user, onSaved }) {
  const { closeModal } = useModal();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [userId, setUserId] = useState(user?.userId || '');
  const [role, setRole] = useState(user?.role || 'staff');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    const id = userId.trim();
    if (id.length < 3) { toast('यूज़र ID कम से कम 3 अक्षर का रखें'); return; }
    if (/\s/.test(id)) { toast('यूज़र ID में जगह (space) न रखें'); return; }
    if (!user || password) {
      if (password.trim().length < 8) { toast('पासवर्ड कम से कम 8 अक्षर का रखें'); return; }
      if (password.trim() !== confirm.trim()) { toast('दोनों पासवर्ड एक जैसे नहीं हैं'); return; }
    }

    const body = { name: name.trim(), userId: id, role };
    if (password) body.password = password.trim();
    setBusy(true);
    try {
      if (user) await api.updateUser(user.id, body);
      else await api.createUser(body);
      toast(user ? 'User अपडेट हो गया ✔' : `User बन गया ✔ — अब "${id}" और पासवर्ड से लॉगिन कर सकते हैं`);
      closeModal();
      onSaved();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="modal-head">
        <h3>{user ? 'User बदलें' : 'नया User बनाएं (Register)'}</h3>
        <button className="modal-close" onClick={closeModal}>✕</button>
      </div>

      <div className="field"><label>नाम</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="जैसे — रमेश (counter)" /></div>
      <div className="field"><label>यूज़र ID (लॉगिन के लिए — बिना space, जैसे ramesh या email)</label>
        <input value={userId} onChange={(e) => setUserId(e.target.value)} autoComplete="off" /></div>
      <div className="field"><label>भूमिका</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="staff">Staff — बिलिंग, ग्राहक, stock, rate, reports</option>
          <option value="admin">Admin — सब कुछ, users और दुकान की settings भी</option>
        </select>
      </div>
      <div className="grid grid-2">
        <div className="field"><label>{user ? 'नया पासवर्ड (खाली छोड़ें तो वही रहेगा)' : 'पासवर्ड'}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></div>
        <div className="field"><label>पासवर्ड दोबारा</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></div>
      </div>
      {user && (
        <p className="small-note" style={{ marginTop: 0 }}>
          पासवर्ड या यूज़र ID बदलते ही इस user का चालू लॉगिन बंद हो जाएगा — नए से दोबारा लॉगिन करना होगा।
        </p>
      )}
      <button className="btn btn-primary" disabled={busy} onClick={save}>
        {busy ? 'Save हो रहा है…' : user ? 'Save करें' : 'User बनाएं'}
      </button>
    </div>
  );
}

export default function Users() {
  const { openModal } = useModal();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.listUsers());
      setErr('');
    } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(u) {
    const msg = u.active
      ? `${u.name || u.userId} का खाता बंद करें? वे तुरंत लॉगआउट हो जाएंगे और लॉगिन नहीं कर पाएंगे।`
      : `${u.name || u.userId} का खाता फिर से चालू करें?`;
    if (!window.confirm(msg)) return;
    try {
      await api.updateUser(u.id, { active: !u.active });
      toast(u.active ? 'खाता बंद कर दिया' : 'खाता चालू हो गया ✔');
      load();
    } catch (e) { toast(e.message); }
  }

  // Admin का फ़ोन खो गया — अगले लॉगिन पर वह नया QR scan करेगा
  async function reset2fa(u) {
    if (!window.confirm(`${u.name || u.userId} का Google Authenticator हटाएं? वे तुरंत लॉगआउट होंगे और अगले लॉगिन पर नया QR scan करेंगे।`)) return;
    try {
      await api.updateUser(u.id, { reset2fa: true });
      toast('Authenticator हटा दिया — अगले लॉगिन पर नया लगेगा');
      load();
    } catch (e) { toast(e.message); }
  }

  async function remove(u) {
    if (!window.confirm(`${u.name || u.userId} (${u.userId}) का खाता हमेशा के लिए हटाएं? बिल, ग्राहक जैसा कोई डेटा नहीं मिटेगा।`)) return;
    try {
      await api.deleteUser(u.id);
      toast('User हटा दिया गया');
      load();
    } catch (e) { toast(e.message); }
  }

  const users = data?.users || [];

  return (
    <div className="card">
      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        Users / Staff
        <button className="btn btn-gold" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => openModal(<UserForm onSaved={load} />)}>
          + नया User बनाएं
        </button>
      </h3>
      <p className="small-note" style={{ marginTop: 0, marginBottom: 12 }}>
        दुकान पर काम करने वालों के अलग यूज़र ID और पासवर्ड बनाएं। <b>Staff</b> बिलिंग, ग्राहक, stock, rate और reports
        चला सकते हैं; <b>Admin</b> इसके साथ users और दुकान की settings भी। खाता बंद करते या पासवर्ड बदलते ही
        वह user तुरंत लॉगआउट हो जाता है। मालिक और Admin को लॉगिन पर <b>Google Authenticator</b> का कोड भी डालना होता है।
      </p>
      {err && <p className="err">{err}</p>}

      <div className="tbl-wrap">
        <table>
          <tbody>
            <tr><th>नाम</th><th>यूज़र ID</th><th>भूमिका</th><th>स्थिति</th><th>आखिरी लॉगिन</th><th></th></tr>
            {data === null ? (
              <tr><td colSpan={6} className="empty">लोड हो रहा है…</td></tr>
            ) : (
              <>
                {data.owner && (
                  <tr>
                    <td><b>मालिक</b></td>
                    <td>{data.owner.userId}</td>
                    <td><span className="badge badge-owner">{ROLE_LABEL.owner}</span></td>
                    <td><span className="badge badge-paid">चालू</span></td>
                    <td>—</td>
                    <td className="small-note">&quot;आज का Rate&quot; पेज से बदलें</td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><b>{u.name || '—'}</b></td>
                    <td>{u.userId}</td>
                    <td>
                      <span className={'badge badge-' + u.role}>{ROLE_LABEL[u.role] || u.role}</span>
                      {u.role === 'admin' && (
                        <div className="small-note" style={{ marginTop: 4 }}>
                          {u.twoFactor ? 'Authenticator ✔' : 'Authenticator अगले लॉगिन पर'}
                        </div>
                      )}
                    </td>
                    <td><span className={'badge ' + (u.active ? 'badge-paid' : 'badge-hidden')}>{u.active ? 'चालू' : 'बंद'}</span></td>
                    <td className="lead-when">{whenLabel(u.lastLoginAt)}</td>
                    <td className="row-actions">
                      <button className="icon-btn" onClick={() => openModal(<UserForm user={u} onSaved={load} />)}>Edit / पासवर्ड</button>
                      <button className="icon-btn" onClick={() => toggleActive(u)}>{u.active ? 'बंद करें' : 'चालू करें'}</button>
                      {u.twoFactor && <button className="icon-btn" onClick={() => reset2fa(u)}>Authenticator हटाएं</button>}
                      <button className="icon-btn" onClick={() => remove(u)}>हटाएं</button>
                    </td>
                  </tr>
                ))}
                {!users.length && (
                  <tr><td colSpan={6} className="empty">अभी कोई staff user नहीं — &quot;+ नया User बनाएं&quot; से जोड़ें</td></tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
