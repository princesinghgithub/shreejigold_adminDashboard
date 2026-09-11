import { useEffect, useState } from 'react';
import { LogoWordmark } from './Logo';
import { api, setToken, apiDisplayUrl } from '../lib/api';

// अंदर "लॉगिन और पासवर्ड" कार्ड (LoginSettings) में मालिक सुरक्षा सवाल इन्हीं में से चुनता है
export const SECURITY_QUESTIONS = [
  'आपके पिताजी का नाम क्या है?',
  'आपका गाँव / जन्म-स्थान कौन सा है?',
  'आपकी दुकान किस साल शुरू हुई?',
  'आपके सबसे पुराने ग्राहक का नाम?',
  'आपकी माताजी का नाम क्या है?',
];
const MIN_PASSWORD = 4;

/**
 * बाहर की स्क्रीन — सिर्फ यूज़र ID + पासवर्ड से लॉगिन. यहाँ कोई register / खाता बनाने का फॉर्म नहीं:
 * मालिक का खाता backend में `npm run seed:admin` से बनता है, बाकी users अंदर "Users / Staff" पेज से.
 */
export default function Login({ onSuccess }) {
  // 'checking' | 'login' | 'nosetup' | 'forgot' | 'offline'
  const [mode, setMode] = useState('checking');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const [userId, setUserId] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [answer, setAnswer] = useState('');
  const [foundQ, setFoundQ] = useState('');
  const [otp, setOtp] = useState('');
  const [otpTo, setOtpTo] = useState(''); // OTP किस (छिपे) email पर गया

  // सर्वर से पूछें — खाता बना है या नहीं
  const checkStatus = async () => {
    setMode('checking');
    setErr('');
    try {
      const s = await api.authStatus();
      setMode(s.isSetup ? 'login' : 'nosetup');
    } catch (e) {
      setErr(e.message);
      setMode('offline');
    }
  };

  useEffect(() => { checkStatus(); }, []);

  function go(next) {
    setMode(next); setErr(''); setMsg('');
    setPass(''); setConfirm(''); setAnswer(''); setFoundQ(''); setOtp(''); setOtpTo('');
  }

  /** हर बटन के लिए एक ही ढाँचा — busy और error एक जगह */
  async function run(fn) {
    if (busy) return;
    setBusy(true);
    setErr('');
    try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  const handleLogin = () => run(async () => {
    if (!userId.trim() || !pass.trim()) throw new Error('यूज़र ID और पासवर्ड दोनों डालें');
    const r = await api.login(userId.trim(), pass.trim());
    setToken(r.token);
    onSuccess(false);
  });

  const findQuestion = () => run(async () => {
    if (!userId.trim()) throw new Error('यूज़र ID डालें');
    setMsg('');
    const r = await api.forgotQuestion(userId.trim());
    setOtpTo('');
    setFoundQ(r.question);
  });

  const sendOtp = () => run(async () => {
    if (!userId.trim()) throw new Error('यूज़र ID (email) डालें');
    const r = await api.forgotSendOtp(userId.trim());
    setFoundQ(''); setOtp('');
    setOtpTo(r.to);
    setMsg(`OTP भेज दिया गया: ${r.to} — ${r.expiresInMinutes} मिनट तक चलेगा। Inbox में न दिखे तो Spam देखें।`);
  });

  const handleReset = () => run(async () => {
    if (!answer.trim()) throw new Error('जवाब लिखें');
    if (pass.trim().length < MIN_PASSWORD) throw new Error(`नया पासवर्ड कम से कम ${MIN_PASSWORD} अक्षर का रखें`);
    if (pass.trim() !== confirm.trim()) throw new Error('दोनों पासवर्ड एक जैसे नहीं हैं');
    await api.forgotReset(userId.trim(), answer.trim(), pass.trim());
    go('login');
    setMsg('नया पासवर्ड सेट हो गया ✔ अब उसी से लॉगिन करें।');
  });

  const handleOtpReset = () => run(async () => {
    if (!/^\d{6}$/.test(otp.trim())) throw new Error('Email में आया 6 अंकों का OTP डालें');
    if (pass.trim().length < MIN_PASSWORD) throw new Error(`नया पासवर्ड कम से कम ${MIN_PASSWORD} अक्षर का रखें`);
    if (pass.trim() !== confirm.trim()) throw new Error('दोनों पासवर्ड एक जैसे नहीं हैं');
    await api.forgotVerifyOtp(userId.trim(), otp.trim(), pass.trim());
    go('login');
    setMsg('नया पासवर्ड सेट हो गया ✔ अब उसी से लॉगिन करें।');
  });

  const enter = (fn) => (e) => { if (e.key === 'Enter') fn(); };

  const tag = {
    checking: 'सर्वर से जुड़ रहे हैं…',
    offline: 'सर्वर से बात नहीं हो पा रही',
    nosetup: 'अभी कोई लॉगिन खाता नहीं बना है',
    forgot: 'पासवर्ड भूल गए? Email पर OTP मँगाएं',
    login: 'बिलिंग व हिसाब सिस्टम — केवल दुकान के लिए',
  }[mode];

  const newPasswordFields = (onEnter) => (
    <>
      <div className="field"><label>नया पासवर्ड</label>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
          placeholder={`कम से कम ${MIN_PASSWORD} अक्षर`} autoComplete="new-password" /></div>
      <div className="field"><label>नया पासवर्ड दोबारा</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={enter(onEnter)} placeholder="वही पासवर्ड फिर से" autoComplete="new-password" /></div>
    </>
  );

  const linkBlock = { display: 'block', margin: '12px auto 0' };

  return (
    <div id="loginScreen">
      <div className="login-card">
        <div className="login-logo"><LogoWordmark /></div>
        <h1>श्री जी आभूषण भण्डार</h1>
        <p className="tag">{tag}</p>

        {mode === 'checking' && <p className="hint">एक पल…</p>}

        {/* ---------- सर्वर बंद है ---------- */}
        {mode === 'offline' && (
          <div>
            <div className="err">{err}</div>
            <p className="hint" style={{ textAlign: 'left' }}>
              ऐप को backend (API) नहीं मिला। पता: <code>{apiDisplayUrl()}</code><br />
              • अपने कंप्यूटर पर: <b>soniji backend</b> फोल्डर में <code>npm run dev</code> चलाएं।<br />
              • Vercel पर: इस ऐप की Environment Variable <code>SHREEJI_URL</code> में backend का पता
              (जैसे <code>https://आपका-backend.vercel.app/api</code>) डालकर दोबारा deploy करें।
            </p>
            <button className="btn btn-primary" onClick={checkStatus}>दोबारा कोशिश करें</button>
          </div>
        )}

        {/* ---------- अभी कोई खाता नहीं — बाहर से बनता नहीं ---------- */}
        {mode === 'nosetup' && (
          <div>
            <p className="hint" style={{ textAlign: 'left' }}>
              मालिक का पहला खाता backend में <code>.env</code> के <code>ADMIN_USER_ID</code> और
              <code> ADMIN_PASSWORD</code> भरकर <code>npm run seed:admin</code> चलाने से बनता है।
              उसके बाद उसी से लॉगिन करके अंदर <b>Users / Staff</b> पेज से बाकी लोगों के खाते बनाएं।
            </p>
            <button className="btn btn-primary" onClick={checkStatus}>खाता बन गया — दोबारा देखें</button>
          </div>
        )}

        {/* ---------- रोज़ का लॉगिन ---------- */}
        {mode === 'login' && (
          <div>
            <div className="field"><label>यूज़र ID</label>
              <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)}
                onKeyDown={enter(handleLogin)} placeholder="अपना यूज़र ID" autoComplete="username" /></div>
            <div className="field"><label>पासवर्ड</label>
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
                onKeyDown={enter(handleLogin)} placeholder="पासवर्ड डालें" autoComplete="current-password" /></div>
            <button className="btn btn-primary" disabled={busy} onClick={handleLogin}>
              {busy ? 'जाँच रहे हैं…' : 'लॉगिन करें'}
            </button>
            <div className="err">{err}</div>
            {msg && <p className="ok-note">{msg}</p>}
            <button className="link-btn" style={{ marginTop: 14 }} onClick={() => go('forgot')}>पासवर्ड भूल गए?</button>
            <p className="hint">नया खाता चाहिए? मालिक या Admin से कहें — खाते अंदर &quot;Users / Staff&quot; पेज से बनते हैं।</p>
          </div>
        )}

        {/* ---------- पासवर्ड भूल गए (मालिक का खाता) ---------- */}
        {mode === 'forgot' && (
          <div>
            <div className="field"><label>यूज़र ID (email)</label>
              <input type="text" value={userId}
                onChange={(e) => { setUserId(e.target.value); setFoundQ(''); setOtpTo(''); setMsg(''); }}
                onKeyDown={enter(sendOtp)} placeholder="अपना यूज़र ID" autoComplete="username" /></div>

            {/* पहला कदम — OTP मँगाएं, या सुरक्षा सवाल से */}
            {!foundQ && !otpTo && (
              <>
                <button className="btn btn-primary" disabled={busy} onClick={sendOtp}>
                  {busy ? 'भेज रहे हैं…' : 'Email पर OTP भेजें'}
                </button>
                <button className="link-btn" style={linkBlock} disabled={busy} onClick={findQuestion}>
                  या सुरक्षा सवाल से पासवर्ड बदलें
                </button>
              </>
            )}

            {/* OTP आ गया */}
            {otpTo && (
              <>
                <div className="field"><label>Email में आया OTP</label>
                  <input type="text" inputMode="numeric" maxLength={6} value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="6 अंक" autoComplete="one-time-code" /></div>
                {newPasswordFields(handleOtpReset)}
                <button className="btn btn-primary" disabled={busy} onClick={handleOtpReset}>
                  {busy ? 'जाँच रहे हैं…' : 'नया पासवर्ड सेट करें'}
                </button>
                <button className="link-btn" style={linkBlock} disabled={busy} onClick={sendOtp}>
                  OTP नहीं आया? दोबारा भेजें
                </button>
              </>
            )}

            {/* सुरक्षा सवाल वाला रास्ता */}
            {foundQ && (
              <>
                <div className="field"><label>{foundQ}</label>
                  <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="जवाब लिखें" /></div>
                {newPasswordFields(handleReset)}
                <button className="btn btn-primary" disabled={busy} onClick={handleReset}>नया पासवर्ड सेट करें</button>
              </>
            )}

            <div className="err">{err}</div>
            {msg && <p className="ok-note">{msg}</p>}
            <button className="link-btn" style={{ marginTop: 14 }} onClick={() => go('login')}>← वापस लॉगिन पर</button>
            <p className="hint">
              पासवर्ड बदलने से Customers, Bills, Stock — कोई भी डेटा नहीं मिटता।
              Staff का पासवर्ड मालिक या Admin अंदर Users पेज से बदलते हैं।
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
