import { createContext, useCallback, useContext, useState } from 'react';
import { api } from '../lib/api';
import { DEFAULT_SETTINGS } from '../lib/storage';

const DataContext = createContext(null);
// टेस्ट में पेजों को बना-बनाया db देने के लिए
export { DataContext };

// लोड होने से पहले पेज खाली ढाँचा देखें, ताकि db.rates जैसी जगहों पर गड़बड़ न हो
const EMPTY = {
  rates: { gold: 0, silver: 0, updatedAt: null },
  customers: [], stock: [], invoices: [], offers: [],
  settings: DEFAULT_SETTINGS(),
};

export function DataProvider({ children }) {
  const [db, setDb] = useState(EMPTY);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState('');

  /** सर्वर से पूरा डेटा दोबारा लाएं — हर बदलाव के बाद यही चलता है */
  const refresh = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? 'ready' : 'loading'));
    try {
      const data = await api.snapshot();
      setDb({ ...EMPTY, ...data, settings: { ...EMPTY.settings, ...(data.settings || {}) } });
      setStatus('ready');
      setError('');
      return true;
    } catch (e) {
      setError(e.message);
      setStatus('error');
      return false;
    }
  }, []);

  /**
   * एक बदलाव करें और फिर सर्वर से ताज़ा डेटा उठाएं.
   * हिसाब (stock घटना, उधारी चढ़ना) सर्वर करता है — इसलिए यहाँ दोहराया नहीं जाता.
   */
  const mutate = useCallback(async (fn) => {
    const result = await fn();
    await refresh();
    return result;
  }, [refresh]);

  function reset() {
    setDb(EMPTY);
    setStatus('idle');
    setError('');
  }

  return (
    <DataContext.Provider value={{ db, status, error, refresh, mutate, reset }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
