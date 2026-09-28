import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { api, setToken } from '../lib/api';
import { SECURITY_QUESTIONS } from './Login';
import BackupCodesList from './BackupCodesList';

const CUSTOM = '__custom__';
const MIN_USERID = 3;
const MIN_PASSWORD = 8;

/** मालिक / Admin — Google Authenticator की हालत और नए backup codes */
function TwoFactorBox() {
  const [st, setSt] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fresh, setFresh] = useState(null);

  const load = () => api.twofaStatus().then(setSt).catch(() => {});
  useEffect(() => { load(); }, []);

  async function regenerate() {
    if (busy) return;
    if (!/^\d{6}$/.test(code.trim())) { setErr('Authenticator का 6 अंकों का कोड डालें'); return; }
    setBusy(true); setErr('');
    try {
      const r = await api.twofaNewBackupCodes(code.trim());
      setFresh(r.backupCodes);
      setCode('');
      load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  const low = st && st.enabled && st.backupCodesLeft <= 3;

  return (
    <div>
      <h4>Google Authenticator</h4>
      <p className="small-note" style={{ marginTop: 0 }}>
        {!st ? '…' : st.enabled ? (
          <>चालू ✔ · backup codes बचे: <b style={low ? { color: 'var(--red)' } : undefined}>{st.backupCodesLeft}</b>
            {low && <span style={{ color: 'var(--red)' }}> — नए बना लें</span>}</>
        ) : 'अगले लॉगिन पर लगाने को कहा जाएगा।'}
      </p>
      {fresh ? (
        <BackupCodesList codes={fresh} doneLabel="हो गया" onDone={() => setFresh(null)} />
      ) : st && st.enabled && (
        <>
          <div className="field"><label>नए backup codes (पुराने सब बंद हो जाएंगे) — Authenticator का कोड</label>
            <input type="text" className="code-input" inputMode="numeric" value={code} placeholder="6 अंक"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="one-time-code" /></div>
          <button className="btn btn-outline" disabled={busy} onClick={regenerate}>
            {busy ? 'बन रहे हैं…' : 'नए backup codes बनाएं'}
          </button>
          <div className="err">{err}</div>
        </>
      )}
      <p className="small-note">
        फ़ोन खो गया और backup codes भी नहीं?{' '}
        {'मालिक: backend में npm run reset-2fa चलाएं। Admin: मालिक "Users / Staff" पेज से हटा देंगे।'}
      </p>
    </div>
  );
}

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
  const has2fa = isOwner || me.role === 'admin';
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
            if (newPass.trim().length < MIN_PASSWORD) throw new Error(`नया पासवर्ड कम से कम ${MIN_PASSWORD} अक्षर का रखें`);
            if (newPass.trim() !== confirm.trim()) throw new Error('दोनों नए पासवर्ड एक जैसे नहीं हैं');
            const r = await api.changePassword(oldPass, newPass);
            // पासवर्ड बदलने पर बाकी जगह के लॉगिन बंद होते हैं — इस device के लिए सर्वर नया token देता है
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

        {has2fa && <TwoFactorBox />}

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
