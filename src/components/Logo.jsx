// असली लोगो फाइल — public/shreeji.png (पारदर्शी background, 1881×836)
export const LOGO_SRC = import.meta.env.BASE_URL + 'shreeji.png';

/**
 * पूरा लोगो — गोल emblem + SHREEJI GOLD.
 * चौड़ी जगहों के लिए: लॉगिन स्क्रीन, सादा बिल का सिरा.
 */
export function LogoWordmark({ style, src }) {
  return (
    <img className="logo-full" src={src || LOGO_SRC} alt="Shreeji Gold" style={style} />
  );
}

/**
 * सिर्फ गोल emblem (SG वाला पेंडेंट) — चौकोर/गोल छोटी जगहों के लिए.
 * पूरी फाइल को बड़ा करके सिर्फ बायाँ हिस्सा दिखाते हैं, इसलिए अलग फाइल की ज़रूरत नहीं.
 * round = गोल खाने में, जिसमें emblem थोड़ा छोटा रखना पड़ता है.
 */
export function LogoIcon({ style, round, src }) {
  return (
    <span className={'logo-mark' + (round ? ' round' : '')} style={style}>
      <img src={src || LOGO_SRC} alt="Shreeji Gold" />
    </span>
  );
}

export function LogoBadge({ style, src }) {
  return <LogoWordmark style={style} src={src} />;
}
