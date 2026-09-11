import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { api, setToken } from '../lib/api';
import { SECURITY_QUESTIONS } from './Login';

const CUSTOM = '__custom__';
const MIN_USERID = 3;
const MIN_PASSWORD = 4;

export default function LoginSettings() {
  const toast = useToast();
  const [me, setMe] = useState(null);          // टोकन से — अभी कौन लॉगिन है
  const [hasQ, setHasQ] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [newId, setNewId] = useState('');
  const [idPass, setIdPass] = useState('');

  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');

  const [qChoice, setQChoice] = useState(SECURITY_QUESTIONS[0]);
  const [qCustom, setQCustom] = useState('');
  const [answer, setAnswer] = useState('');
  const [qPass, setQPass] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [u, s] = await Promise.all([api.me(), api.authStatus()]);
        setMe(u.user);
        setNewId(u.user.name || u.user.sub || '');
        setHasQ(Boolean(s.hasSecurityQuestion));
      } catch { /* नहीं मिला तो कार्ड चुपचाप छिपा रहेगा */ }
    })();
  }, []);

  if (!me) return null;
  const isOwner = me.role === 'owner';
  const question = qChoice === CUSTOM ? qCustom : qChoice;

  async function run(fn, okMsg, clear) {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await fn();
      clear();
      toast(okMsg);
      if (isOwner) {
        const s = await api.authStatus();
        setHasQ(Boolean(s.hasSecurityQuestion));
      }
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="card auth-card">
      <h3>लॉगिन और पासवर्ड</h3>
      <p className="small-note" style={{ marginTop: 0 }}>
        {isOwner ? (
          <>
            अभी का यूज़र ID: <b>{me.name || me.sub}</b>
            {hasQ
              ? <> · सुरक्षा सवाल सेट है ✔</>
              : <> · <span style={{ color: 'var(--red)' }}>सुरक्षा सवाल सेट नहीं है — नीचे सेट कर लें,
                वरना पासवर्ड भूलने पर वापस नहीं मिलेगा</span></>}
          </>
        ) : (
          <>
            आप <b>{me.name || me.sub}</b> ({me.role === 'admin' ? 'Admin' : 'Staff'}) खाते से लॉगिन हैं — यूज़र ID: <b>{me.sub}</b>.
            {' '}पासवर्ड भूल जाएं तो मालिक या Admin &quot;Users / Staff&quot; पेज से नया बना देंगे।
          </>
        )}
      </p>

      <div className="auth-row">
        <div>
          <h4>पासवर्ड बदलें</h4>
          <div className="field"><label>पुराना पासवर्ड</label>
            <input type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} autoComplete="current-password" /></div>
          <div className="field"><label>नया पासवर्ड</label>
            <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)}
              placeholder={`कम से कम ${MIN_PASSWORD} अक्षर`} autoComplete="new-password" /></div>
          <div className="field"><label>नया पासवर्ड दोबारा</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></div>
          <button className="btn btn-outline" disabled={busy} onClick={() => run(async () => {
            if (newPass.trim() !== confirm.trim()) throw new Error('दोनों नए पासवर्ड एक जैसे नहीं हैं');
            const r = await api.changePassword(oldPass, newPass);
            // staff / admin का पासवर्ड बदलने पर पुराने लॉगिन बंद होते हैं — सर्वर नया token देता है
            if (r && r.token) setToken(r.token);
          }, 'पासवर्ड बदल गया ✔', () => { setOldPass(''); setNewPass(''); setConfirm(''); })}>
            पासवर्ड बदलें
          </button>
        </div>

        {isOwner && (
          <div>
            <h4>यूज़र ID बदलें</h4>
            <div className="field"><label>नया यूज़र ID</label>
              <input type="text" value={newId} onChange={(e) => setNewId(e.target.value)}
                placeholder={`कम से कम ${MIN_USERID} अक्षर`} /></div>
            <div className="field"><label>पक्का करने के लिए पासवर्ड</label>
              <input type="password" value={idPass} onChange={(e) => setIdPass(e.target.value)} autoComplete="current-password" /></div>
            <button className="btn btn-outline" disabled={busy} onClick={() => run(async () => {
              const r = await api.changeUserId(idPass, newId);
              // यूज़र ID टोकन में भी है — सर्वर ने नया टोकन दिया है
              setToken(r.token);
              setMe({ ...me, name: r.userId, sub: r.userId.toLowerCase() });
            }, 'यूज़र ID बदल गया ✔', () => setIdPass(''))}>
              यूज़र ID बदलें
            </button>
          </div>
        )}

        {isOwner && (
          <div>
            <h4>सुरक्षा सवाल</h4>
            <div className="field"><label>सवाल</label>
              <select value={qChoice} onChange={(e) => setQChoice(e.target.value)}>
                {SECURITY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                <option value={CUSTOM}>अपना सवाल लिखें…</option>
              </select></div>
            {qChoice === CUSTOM && (
              <div className="field"><label>आपका सवाल</label>
                <input type="text" value={qCustom} onChange={(e) => setQCustom(e.target.value)} /></div>
            )}
            <div className="field"><label>जवाब</label>
              <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="जवाब याद रखें" /></div>
            <div className="field"><label>पक्का करने के लिए पासवर्ड</label>
              <input type="password" value={qPass} onChange={(e) => setQPass(e.target.value)} autoComplete="current-password" /></div>
            <button className="btn btn-outline" disabled={busy} onClick={() => run(
              () => api.setSecurityQuestion(qPass, question, answer),
              'सुरक्षा सवाल सेट हो गया ✔', () => { setAnswer(''); setQPass(''); },
            )}>सवाल सेट करें</button>
          </div>
        )}
      </div>

      <div className="err">{err}</div>
    </div>
  );
}
