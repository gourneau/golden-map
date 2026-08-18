// A minimal SoundCloud transport — the backup engine for audio we are not
// allowed to host ourselves.
//
// Why it exists: Music and the two United Nations sections stream from
// archive.org, and archive.org is routinely blocked wholesale by corporate,
// school and ISP filters (it gets false-flagged as BitTorrent), and has had
// long outages. Its /download/ URLs also 302 to a per-request node hostname
// (dn720301.ca.archive.org, ia800100.us.archive.org, …), so a filter that only
// blocks *.archive.org subdomains breaks playback while archive.org itself
// still resolves. A visitor on a perfectly healthy Mac got silence.
//
// This is NOT the old 430-line widget state machine that commit 8fac379 deleted
// — it is the smallest wrapper that can play, pause and seek, so the dock's own
// transport can drive it exactly like the <audio> element. The site's own track
// names and credits are unaffected: SoundCloud supplies bytes and nothing else.

const API = 'https://w.soundcloud.com/player/api.js';
let apiPromise = null;

// Loaded once, and only if the fallback is actually needed — the shim is 5.5KB
// and a healthy visitor never fetches it.
function loadApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.SC && window.SC.Widget) { resolve(window.SC); return; }
    const s = document.createElement('script');
    s.src = API;
    s.async = true;
    s.onload = () => (window.SC && window.SC.Widget ? resolve(window.SC) : reject(new Error('SC absent')));
    s.onerror = () => reject(new Error('SoundCloud API failed to load'));
    document.head.appendChild(s);
  }).catch((e) => { apiPromise = null; throw e; }); // let a later attempt retry
  return apiPromise;
}

// `host` is an off-screen container owned by the caller. Callbacks are optional.
// Resolves once the widget is READY; rejects if the API or the widget never comes.
export function createSoundCloud({ url, host, onPlay, onPause, onProgress, onFinish }) {
  return loadApi().then((SC) => new Promise((resolve, reject) => {
    host.innerHTML = '';
    const f = document.createElement('iframe');
    f.allow = 'autoplay';
    f.tabIndex = -1; // parked off-screen inside aria-hidden: never a tab stop
    f.title = 'Golden Record audio (SoundCloud backup source)';
    f.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(url) +
      '&auto_play=false&visual=false&show_teaser=false&show_comments=false&color=%23c9a227';
    host.appendChild(f);

    const w = SC.Widget(f);
    const E = SC.Widget.Events;
    let duration = 0;
    // The widget can simply never answer — the same filters that block
    // archive.org sometimes block SoundCloud too, and then READY never fires and
    // the caller would wait forever on a promise.
    const giveUp = setTimeout(() => reject(new Error('SoundCloud widget never became ready')), 12000);

    w.bind(E.READY, () => {
      clearTimeout(giveUp);
      w.getDuration((d) => { duration = d || 0; });
      if (onPlay) w.bind(E.PLAY, onPlay);
      if (onPause) w.bind(E.PAUSE, onPause);
      if (onFinish) w.bind(E.FINISH, onFinish);
      if (onProgress) w.bind(E.PLAY_PROGRESS, (e) => onProgress(e.currentPosition || 0, duration));
      resolve({
        play: () => w.play(),
        pause: () => w.pause(),
        seekMs: (ms) => w.seekTo(Math.max(0, Math.round(ms))),
        duration: () => duration,
        destroy: () => { try { w.pause(); } catch { /* iframe may be gone */ } host.innerHTML = ''; },
      });
    });
  }));
}
