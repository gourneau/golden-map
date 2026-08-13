// The 55 spoken greetings, in the order they were pressed onto the record —
// which is also the order of NASA's SoundCloud playlist, so the index is
// load-bearing: it maps 1:1 to widget.skip(i).
//
// `native` is each language's own name in its own script. Five languages here
// are ancient and their scripts (cuneiform, Old Aramaic, Hittite hieroglyphs)
// have no reliable system font — a browser would render empty boxes — so those
// carry a romanised endonym instead. Better a real word than tofu.
//
// `lang` is the BCP-47 tag for the `lang` attribute, so a screen reader
// switches voice and the browser picks a font that can draw the script. It is
// null where no tag exists (Ila) or where the record's label is a family rather
// than a language.
//
// `file` is the slug under vendor/audio/greetings/ — NASA published every
// greeting individually on the retired voyager.jpl.nasa.gov, public domain, and
// we host them ourselves. Null means we have no per-language file.

export const GREETINGS = [
  { name: 'Akkadian',           native: 'Akkadû',           lang: 'akk', file: 'akkadian' , says: 'May all be very well.' },
  { name: 'Amoy (Min dialect)', native: 'Bân-lâm-gú',       lang: 'nan', file: 'amoy' , says: 'Friends from space, how are you all? Have you eaten yet? Come visit us if you have time.' },
  { name: 'Arabic',             native: 'العربية',            lang: 'ar',  file: 'arabic' , says: 'Greetings to our friends in the stars. We wish that we will meet you someday.' },
  { name: 'Aramaic',            native: 'Ārāmāyā',          lang: 'arc', file: 'aramaic' , says: 'Peace' },
  { name: 'Armenian',           native: 'Հայերեն',           lang: 'hy',  file: 'armenian' , says: 'To all those who exist in the universe, greetings.' },
  { name: 'Bengali',            native: 'বাংলা',              lang: 'bn',  file: 'bengali' , says: 'Hello! Let there be peace everywhere.' },
  { name: 'Burmese',            native: 'မြန်မာဘာသာ',          lang: 'my',  file: 'burmese' , says: 'Are you well?' },
  { name: 'Cantonese',          native: '廣東話',            lang: 'yue', file: 'cantonese' , says: 'Hi. How are you? Wish you peace, health and happiness.' },
  { name: 'Czech',              native: 'Čeština',          lang: 'cs',  file: 'czech' , says: 'Dear Friends, we wish you the best.' },
  { name: 'Dutch',              native: 'Nederlands',       lang: 'nl',  file: 'dutch' , says: 'Dear/sincere greetings to everyone' },
  { name: 'English',            native: 'English',          lang: 'en',  file: 'english' , says: 'Hello from the children of planet Earth.' },
  { name: 'French',             native: 'Français',         lang: 'fr',  file: 'french' , says: 'Hello everybody.' },
  { name: 'German',             native: 'Deutsch',          lang: 'de',  file: 'german' , says: 'Heartfelt greetings to all.' },
  { name: 'Greek',              native: 'Ελληνικά',         lang: 'el',  file: 'greek' , says: 'Greetings to you, whoever you are. We come in friendship to those who are friends.' },
  { name: 'Gujarati',           native: 'ગુજરાતી',            lang: 'gu',  file: 'gujarati' , says: 'Greetings from a human being of the Earth. Please contact.' },
  { name: 'Hebrew',             native: 'עברית',             lang: 'he',  file: 'hebrew' , says: 'Peace.' },
  { name: 'Hindi',              native: 'हिन्दी',              lang: 'hi',  file: 'hindi' , says: 'Greetings from the inhabitants of this world.' },
  { name: 'Hittite',            native: 'Nešili',           lang: 'hit', file: 'hittite' , says: 'Hail.' },
  { name: 'Hungarian (Magyar)', native: 'Magyar',           lang: 'hu',  file: 'hungarian' , says: 'We are sending greetings in the Hungarian language to all peace-loving beings in the Universe.' },
  { name: 'Ila (Zambia)',       native: 'Chiila',           lang: null,  file: 'ila' , says: 'We wish all of you well.' },
  { name: 'Indonesian',         native: 'Bahasa Indonesia', lang: 'id',  file: 'indonesian' , says: 'Good night, ladies and gentlemen. Goodbye and see you next time.' },
  { name: 'Italian',            native: 'Italiano',         lang: 'it',  file: 'italian' , says: 'Many greetings and wishes.' },
  { name: 'Japanese',           native: '日本語',            lang: 'ja',  file: 'japanese' , says: 'Hello? How are you?' },
  { name: 'Kannada (Kanarese)', native: 'ಕನ್ನಡ',              lang: 'kn',  file: 'kannada' , says: 'Greetings. On behalf of Kannada-speaking people, \'good wishes.\'' },
  { name: 'Kechua (Quechua)',   native: 'Runa Simi',        lang: 'qu',  file: 'kechua' , says: 'Hello to everybody from this Earth, in Kechua language.' },
  { name: 'Korean',             native: '한국어',            lang: 'ko',  file: 'korean' , says: 'How are you?' },
  { name: 'Latin',              native: 'Lingua Latina',    lang: 'la',  file: 'latin' , says: 'Greetings to you, whoever you are; we have good will towards you and bring peace across space.' },
  { name: 'Luganda (Ganda)',    native: 'Luganda',          lang: 'lg',  file: 'luganda' , says: 'Greetings to all peoples of the universe. God give you peace always.' },
  { name: 'Mandarin Chinese',   native: '普通话',            lang: 'zh',  file: 'mandarin' , says: 'Hope everyone\'s well. We are thinking about you all. Please come here to visit when you have time.' },
  { name: 'Marathi',            native: 'मराठी',              lang: 'mr',  file: 'marathi' , says: 'Greetings. The people of the Earth send their good wishes.' },
  { name: 'Nepali',             native: 'नेपाली',              lang: 'ne',  file: 'nepali' , says: 'Wishing you a peaceful future from the earthlings.' },
  { name: 'Nguni (Zulu)',       native: 'isiZulu',          lang: 'zu',  file: 'nguni' , says: 'We greet you, great ones. We wish you longevity.' },
  { name: 'Nyanja',             native: 'Chinyanja',        lang: 'ny',  file: 'nyanja' , says: 'How are all you people of other planets?' },
  { name: 'Oriya',              native: 'ଓଡ଼ିଆ',              lang: 'or',  file: 'oriya' , says: 'Greetings to the inhabitants of the universe from the third planet Earth of the star Sun.' },
  { name: 'Persian',            native: 'فارسی',             lang: 'fa',  file: 'persian' , says: 'Greetings to the residents of far skies.' },
  { name: 'Polish',             native: 'Polski',           lang: 'pl',  file: 'polish' , says: 'Welcome, creatures from beyond the outer world.' },
  { name: 'Portuguese',         native: 'Português',        lang: 'pt',  file: 'portuguese' , says: 'Peace and happiness to all.' },
  { name: 'Punjabi',            native: 'ਪੰਜਾਬੀ',              lang: 'pa',  file: 'punjabi' , says: 'Welcome home. It is a pleasure to receive you.' },
  { name: 'Rajasthani',         native: 'राजस्थानी',           lang: 'raj', file: 'rajasthani' , says: 'Hello to everyone. We are happy here and you be happy there.' },
  { name: 'Romanian',           native: 'Română',           lang: 'ro',  file: 'romanian' , says: 'Greetings to everybody.' },
  { name: 'Russian',            native: 'Русский',          lang: 'ru',  file: 'russian' , says: 'Greetings! I Welcome You!' },
  { name: 'Serbian',            native: 'Српски',           lang: 'sr',  file: 'serbian' , says: 'We wish you everything good from our planet.' },
  { name: 'Sinhalese',          native: 'සිංහල',             lang: 'si',  file: 'sinhalese' , says: 'Wish You a Long Life.' },
  { name: 'Sotho (Sesotho)',    native: 'Sesotho',          lang: 'st',  file: 'sotho' , says: 'We greet you, O great ones.' },
  { name: 'Spanish',            native: 'Español',          lang: 'es',  file: 'spanish' , says: 'Hello and greetings to all.' },
  { name: 'Sumerian',           native: 'Eme-ĝir',          lang: 'sux', file: 'sumerian' , says: 'May all be well.' },
  { name: 'Swedish',            native: 'Svenska',          lang: 'sv',  file: 'swedish' , says: 'Greetings from a computer programmer in the little university town of Ithaca on the planet Earth' },
  { name: 'Telugu',             native: 'తెలుగు',             lang: 'te',  file: 'telugu' , says: 'Greetings. Best wishes from Telugu-speaking people.' },
  { name: 'Thai',               native: 'ภาษาไทย',           lang: 'th',  file: 'thai' , says: 'We in this world send you our good will' },
  { name: 'Turkish',            native: 'Türkçe',           lang: 'tr',  file: 'turkish' , says: 'Dear Turkish-speaking friends, may the honors of the morning be upon your heads.' },
  { name: 'Ukrainian',          native: 'Українська',       lang: 'uk',  file: 'ukrainian' , says: 'We are sending greetings from our world, wishing you happiness, goodness, good health and many years.' },
  { name: 'Urdu',               native: 'اردو',              lang: 'ur',  file: 'urdu' , says: 'Peace on you. We the inhabitants of this earth send our greetings to you.' },
  { name: 'Vietnamese',         native: 'Tiếng Việt',       lang: 'vi',  file: 'vietnamese' , says: 'Sincerely send you our friendly greetings.' },
  { name: 'Welsh',              native: 'Cymraeg',          lang: 'cy',  file: 'welsh' , says: 'Good health to you now and forever.' },
  { name: 'Wu',                 native: '吴语',              lang: 'wuu', file: 'wu' , says: 'Best wishes to you all.' },
];

// Short names for the masthead button, which says "hear them say hello in ___"
// and has no room for NASA's parenthetical disambiguations.
const SHORT = {
  'Amoy (Min dialect)': 'Amoy',
  'Hungarian (Magyar)': 'Hungarian',
  'Kannada (Kanarese)': 'Kannada',
  'Kechua (Quechua)': 'Quechua',
  'Nguni (Zulu)': 'Zulu',
  'Sotho (Sesotho)': 'Sesotho',
  'Ila (Zambia)': 'Ila',
  'Mandarin Chinese': 'Mandarin',
  Wu: 'Wu Chinese',
};
export const shortName = (g) => SHORT[g.name] || g.name;

// Browser locale -> greeting. Region-qualified tags are tried before the bare
// primary subtag, which is the only way zh-HK reaches Cantonese rather than
// Mandarin.
const REGION = {
  'zh-hk': 'cantonese', 'zh-mo': 'cantonese', 'zh-hant-hk': 'cantonese',
  'zh-min-nan': 'amoy', 'nan-tw': 'amoy',
};
const PRIMARY = {
  ar: 'arabic', hy: 'armenian', bn: 'bengali', my: 'burmese', yue: 'cantonese',
  cs: 'czech', nl: 'dutch', en: 'english', fr: 'french', de: 'german',
  el: 'greek', gu: 'gujarati', he: 'hebrew', iw: 'hebrew', hi: 'hindi',
  hu: 'hungarian', id: 'indonesian', in: 'indonesian', it: 'italian',
  ja: 'japanese', kn: 'kannada', qu: 'kechua', quz: 'kechua', quy: 'kechua',
  ko: 'korean', la: 'latin', lg: 'luganda', zh: 'mandarin', cmn: 'mandarin',
  mr: 'marathi', ne: 'nepali', zu: 'nguni', ny: 'nyanja', or: 'oriya',
  ory: 'oriya', fa: 'persian', prs: 'persian', pl: 'polish', pt: 'portuguese',
  pa: 'punjabi', pnb: 'punjabi', raj: 'rajasthani', mwr: 'rajasthani',
  ro: 'romanian', mo: 'romanian', ru: 'russian', sr: 'serbian', sh: 'serbian',
  si: 'sinhalese', st: 'sotho', es: 'spanish', sv: 'swedish', te: 'telugu',
  th: 'thai', tr: 'turkish', uk: 'ukrainian', ur: 'urdu', vi: 'vietnamese',
  cy: 'welsh', nan: 'amoy', wuu: 'wu',
};

// DELIBERATELY NOT MAPPED — do not "fix" these:
//   ta, ml, as, ks, sd, sa  — Tamil, Malayalam and the rest are simply not on
//     the record. Aliasing ta -> telugu would be wrong and would read as an
//     insult; unmatched locales get English, which is honest.
//   ms -> indonesian, af -> dutch  — close relatives, different languages.
//   ca, gl, eu -> spanish          — exactly the aliasing that generates mail.
//   hr, bs, cnr -> serbian         — politically loaded. Don't.
//   xh, ss, nr, nd -> nguni        — the record's track is labelled "Nguni" but
//     was recorded in Zulu, so only `zu` maps and it is labelled Zulu.
//   zh-TW -> mandarin (not wu)     — Wu is Shanghainese; Traditional Chinese in
//     Taiwan is Mandarin. Only an explicit nan/zh-min-nan tag means Amoy.

const byFile = (f) => GREETINGS.find((g) => g.file === f);

// Walk the visitor's language preferences in order and return the first
// greeting we can actually play. Falls back to English, which is also what an
// unrecognised locale gets.
export function pickGreeting(langs) {
  const list = Array.isArray(langs) && langs.length ? langs : ['en'];
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const tag = raw.toLowerCase().replace(/_/g, '-');
    const parts = tag.split('-');
    const tries = [
      tag,
      parts.length > 2 ? `${parts[0]}-${parts[parts.length - 1]}` : null,
      parts.length > 1 ? `${parts[0]}-${parts[1]}` : null,
      parts[0],
    ].filter(Boolean);
    for (const t of tries) {
      const file = REGION[t] || PRIMARY[t];
      if (file) return byFile(file);
    }
  }
  return byFile('english');
}
