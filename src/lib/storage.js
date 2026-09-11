// बिल और दुकान की settings का ढाँचा. असली मान सर्वर से आते हैं —
// यह सिर्फ तब काम आता है जब सर्वर का जवाब आने से पहले पेज बन जाए.
export function DEFAULT_SETTINGS() {
  return {
    gst: 3,
    shopName: 'Shreeji Gold',
    shopNameHindi: 'श्री जी आभूषण भण्डार',
    logoUrl: '/shreeji.png',
    nameSuffix: '',
    blessing: '॥ श्री हरि कृपा ॥',
    tagline: 'शुद्ध सोने एवं चांदी के आभूषणों के निर्माता एवं विक्रेता',
    propName: 'प्रो. धीरेन्द्र सोनी',
    shopAddress: 'शाहपुर रोड, शांति नगर, खतखरी, तिवारी होटल के बगल में',
    shopPhone: '9131154535',
    shopPhone2: '7049749596',
    gstin: '',
    jurisdiction: 'Mauganj',
    categories: 'GOLD | DIAMOND | SILVER | GEMS | GOLD LOAN',
    hsn: '7113',
    hallmarkLabel: 'Hallmark',
    footerNote: 'जेवर टूटने की कोई भी गारंटी नहीं होगी।',
    billTemplate: 'slip',
    websiteUrl: '',
  };
}
