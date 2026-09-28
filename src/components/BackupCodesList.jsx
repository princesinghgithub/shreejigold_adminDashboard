import { useState } from 'react';

/**
 * Backup codes — सर्वर पर सिर्फ इनका hash रहता है, इसलिए ये एक ही बार दिखते हैं.
 * Copy / Download दोनों, और "save कर लिए" पर निशान लगाए बिना आगे नहीं.
 */
export default function BackupCodesList({ codes, onDone, doneLabel = 'आगे बढ़ें' }) {
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState('');
  const text = codes.join('\n');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setNote('Copy हो गए ✔');
    } catch {
      setNote('Copy नहीं हुआ — Download करें या लिख लें');
    }
  }

  function download() {
    const content = [
      'Shreeji Gold — Backup Codes',
      'बने: ' + new Date().toLocaleString('en-IN'),
      '',
      'हर code सिर्फ एक बार चलेगा. Google Authenticator वाला फ़ोन पास न हो तो',
      'लॉगिन पर 6 अंकों के कोड की जगह इनमें से एक डालें.',
      '',
      ...codes,
      '',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shreeji-gold-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div>
      <p className="small-note" style={{ textAlign: 'left', marginTop: 0 }}>
        फ़ोन खो जाए या Authenticator न खुले, तब इनसे लॉगिन होगा। <b>हर code एक ही बार चलेगा।</b>{' '}
        ये दोबारा नहीं दिखेंगे — अभी सुरक्षित जगह रख लें (फ़ोन के अलावा कहीं)।
      </p>
      <div className="code-grid">
        {codes.map((c) => <div key={c}>{c}</div>)}
      </div>
      <div className="code-actions">
        <button type="button" className="btn btn-outline" onClick={copy}>Copy</button>
        <button type="button" className="btn btn-outline" onClick={download}>Download</button>
      </div>
      {note && <p className="ok-note" style={{ marginTop: 0 }}>{note}</p>}
      <label className="check-row">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        मैंने backup codes सुरक्षित जगह save कर लिए
      </label>
      {onDone && (
        <button type="button" className="btn btn-primary" disabled={!saved} onClick={onDone}>{doneLabel}</button>
      )}
    </div>
  );
}
