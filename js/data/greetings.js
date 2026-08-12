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
  { name: 'Akkadian',           native: 'Akkadû',           lang: 'akk', file: 'akkadian' },
  { name: 'Amoy (Min dialect)', native: 'Bân-lâm-gú',       lang: 'nan', file: 'amoy' },
  { name: 'Arabic',             native: 'العربية',            lang: 'ar',  file: 'arabic' },
  { name: 'Aramaic',            native: 'Ārāmāyā',          lang: 'arc', file: 'aramaic' },
  { name: 'Armenian',           native: 'Հայերեն',           lang: 'hy',  file: 'armenian' },
  { name: 'Bengali',            native: 'বাংলা',              lang: 'bn',  file: 'bengali' },
  { name: 'Burmese',            native: 'မြန်မာဘာသာ',          lang: 'my',  file: 'burmese' },
  { name: 'Cantonese',          native: '廣東話',            lang: 'yue', file: 'cantonese' },
  { name: 'Czech',              native: 'Čeština',          lang: 'cs',  file: 'czech' },
  { name: 'Dutch',              native: 'Nederlands',       lang: 'nl',  file: 'dutch' },
  { name: 'English',            native: 'English',          lang: 'en',  file: 'english' },
  { name: 'French',             native: 'Français',         lang: 'fr',  file: 'french' },
  { name: 'German',             native: 'Deutsch',          lang: 'de',  file: 'german' },
  { name: 'Greek',              native: 'Ελληνικά',         lang: 'el',  file: 'greek' },
  { name: 'Gujarati',           native: 'ગુજરાતી',            lang: 'gu',  file: 'gujarati' },
  { name: 'Hebrew',             native: 'עברית',             lang: 'he',  file: 'hebrew' },
  { name: 'Hindi',              native: 'हिन्दी',              lang: 'hi',  file: 'hindi' },
  { name: 'Hittite',            native: 'Nešili',           lang: 'hit', file: 'hittite' },
  { name: 'Hungarian (Magyar)', native: 'Magyar',           lang: 'hu',  file: 'hungarian' },
  { name: 'Ila (Zambia)',       native: 'Chiila',           lang: null,  file: 'ila' },
  { name: 'Indonesian',         native: 'Bahasa Indonesia', lang: 'id',  file: 'indonesian' },
  { name: 'Italian',            native: 'Italiano',         lang: 'it',  file: 'italian' },
  { name: 'Japanese',           native: '日本語',            lang: 'ja',  file: 'japanese' },
  { name: 'Kannada (Kanarese)', native: 'ಕನ್ನಡ',              lang: 'kn',  file: 'kannada' },
  { name: 'Kechua (Quechua)',   native: 'Runa Simi',        lang: 'qu',  file: 'kechua' },
  { name: 'Korean',             native: '한국어',            lang: 'ko',  file: 'korean' },
  { name: 'Latin',              native: 'Lingua Latina',    lang: 'la',  file: 'latin' },
  { name: 'Luganda (Ganda)',    native: 'Luganda',          lang: 'lg',  file: 'luganda' },
  { name: 'Mandarin Chinese',   native: '普通话',            lang: 'zh',  file: 'mandarin' },
  { name: 'Marathi',            native: 'मराठी',              lang: 'mr',  file: 'marathi' },
  { name: 'Nepali',             native: 'नेपाली',              lang: 'ne',  file: 'nepali' },
  { name: 'Nguni (Zulu)',       native: 'isiZulu',          lang: 'zu',  file: 'nguni' },
  { name: 'Nyanja',             native: 'Chinyanja',        lang: 'ny',  file: 'nyanja' },
  { name: 'Oriya',              native: 'ଓଡ଼ିଆ',              lang: 'or',  file: 'oriya' },
  { name: 'Persian',            native: 'فارسی',             lang: 'fa',  file: 'persian' },
  { name: 'Polish',             native: 'Polski',           lang: 'pl',  file: 'polish' },
  { name: 'Portuguese',         native: 'Português',        lang: 'pt',  file: 'portuguese' },
  { name: 'Punjabi',            native: 'ਪੰਜਾਬੀ',              lang: 'pa',  file: 'punjabi' },
  { name: 'Rajasthani',         native: 'राजस्थानी',           lang: 'raj', file: 'rajasthani' },
  { name: 'Romanian',           native: 'Română',           lang: 'ro',  file: 'romanian' },
  { name: 'Russian',            native: 'Русский',          lang: 'ru',  file: 'russian' },
  { name: 'Serbian',            native: 'Српски',           lang: 'sr',  file: 'serbian' },
  { name: 'Sinhalese',          native: 'සිංහල',             lang: 'si',  file: 'sinhalese' },
  { name: 'Sotho (Sesotho)',    native: 'Sesotho',          lang: 'st',  file: 'sotho' },
  { name: 'Spanish',            native: 'Español',          lang: 'es',  file: 'spanish' },
  { name: 'Sumerian',           native: 'Eme-ĝir',          lang: 'sux', file: 'sumerian' },
  { name: 'Swedish',            native: 'Svenska',          lang: 'sv',  file: 'swedish' },
  { name: 'Telugu',             native: 'తెలుగు',             lang: 'te',  file: 'telugu' },
  { name: 'Thai',               native: 'ภาษาไทย',           lang: 'th',  file: 'thai' },
  { name: 'Turkish',            native: 'Türkçe',           lang: 'tr',  file: 'turkish' },
  { name: 'Ukrainian',          native: 'Українська',       lang: 'uk',  file: 'ukrainian' },
  { name: 'Urdu',               native: 'اردو',              lang: 'ur',  file: 'urdu' },
  { name: 'Vietnamese',         native: 'Tiếng Việt',       lang: 'vi',  file: 'vietnamese' },
  { name: 'Welsh',              native: 'Cymraeg',          lang: 'cy',  file: 'welsh' },
  { name: 'Wu',                 native: '吴语',              lang: 'wuu', file: 'wu' },
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
