const express = require("express");
const { makeToken, resolveToken, resolveTokenFull } = require("../lib/tokens");
const { extractFromPage, resolvePlayerM3u8 } = require("../lib/extractor");

const CODE = process.env.FHD_CODE || "";
const API = process.env.FHD_API || "https://fashd.com/faselhd15/public/api/";
const BACKUPS = (process.env.FHD_BACKUPS || [
  "https://7odaeg.com/v2/public/api/",
  "https://abcdef.flech.tn/egybestantojdid/public/api/",
  "https://hrrejhp.com/mycimaa/public/api/",
  "https://hrrejhp.com/mycimajihedv20/public/api/",
  "https://hrrejgh.com/wecima15/public/api/",
  "https://azertyquiz.com/shahed15/public/api/",
  "https://3echk.com/mortadha/public/api/"
].join(",")).split(",").map((s) => s.trim()).filter(Boolean);
const SITE = process.env.FHD_SITE || "https://web8818x.faselhdx.life";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Accept-Language": "ar,en;q=0.9" };
const CDN_HEADERS = { ...HEADERS, Referer: SITE + "/", Origin: SITE };

const app = express();
const cache = new Map();
const rl = new Map();
const tokCache = new Map();
const CACHE_MS = 1800 * 1000;
const RATE_MAX = 5;

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>7esen HD | بث مباشر</title>
<style>
:root { --bg:#0b0d12; --card:#141823; --border:#232a3a; --text:#e8ecf4; --dim:#8b93a7; --accent:#ff434c; --accent2:#6c5ce7; }
* { box-sizing:border-box; margin:0; padding:0; }
body { background:var(--bg); color:var(--text); font-family:'Segoe UI',Tahoma,sans-serif; min-height:100vh; }
header { padding:22px; text-align:center; border-bottom:1px solid var(--border); }
header h1 { font-size:26px; letter-spacing:.5px; }
header h1 span { color:var(--accent); }
header p { color:var(--dim); font-size:13px; margin-top:6px; }
.search-wrap { max-width:640px; margin:30px auto 0; padding:0 16px; }
.search-box { display:flex; gap:10px; }
.search-box input { flex:1; padding:14px 18px; border-radius:12px; border:1px solid var(--border); background:var(--card); color:var(--text); font-size:16px; outline:none; }
.search-box input:focus { border-color:var(--accent); }
.search-box button { padding:14px 26px; border:none; border-radius:12px; background:var(--accent); color:#fff; font-size:16px; font-weight:bold; cursor:pointer; }
.search-box button:disabled { opacity:.5; cursor:wait; }
#status { text-align:center; color:var(--dim); margin:16px 0; font-size:14px; }
#results { max-width:1000px; margin:20px auto; padding:0 16px; display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:14px; }
.movie { background:var(--card); border:1px solid var(--border); border-radius:14px; overflow:hidden; cursor:pointer; transition:transform .15s, border-color .15s; }
.movie:hover { transform:translateY(-3px); border-color:var(--accent); }
.movie img { width:100%; aspect-ratio:2/3; object-fit:cover; background:#000; display:block; }
.movie .info { padding:10px 12px; }
.movie .info .t { font-size:14px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.movie .info .y { color:var(--dim); font-size:12px; margin-top:3px; }
.movie .info .l { color:var(--accent2); font-size:11px; margin-top:4px; }
.hint { text-align:center; color:var(--dim); margin-top:80px; font-size:15px; }
.hint b { color:var(--accent); }
</style>
</head>
<body>
<header>
  <h1>🎬 7esen <span>HD</span></h1>
  <p>ابحث عن أي فيلم واحصل على رابط تشغيل فوري</p>
</header>
<div class="search-wrap">
  <div class="search-box">
    <input id="q" type="text" placeholder="اسم الفيلم... (مثال: Interstellar)">
    <button id="btn">بحث</button>
  </div>
</div>
<div id="status"></div>
<div id="results"></div>

<script>
const qEl = document.getElementById('q');
const btn = document.getElementById('btn');
const st = document.getElementById('status');
const res = document.getElementById('results');

btn.addEventListener('click', search);
qEl.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });

async function search() {
  const q = qEl.value.trim();
  if (!q) return;
  btn.disabled = true;
  st.textContent = 'جاري البحث...';
  res.innerHTML = '';
  try {
    const r = await fetch('/api/search?q=' + encodeURIComponent(q));
    const data = await r.json();
    if (!data.results.length) { st.textContent = 'مفيش نتائج 😐'; return; }
    st.textContent = 'لقيت ' + data.results.length + ' نتيجة' + (data.server ? ' — المصدر: ' + data.server : '');
    render(data.results);
  } catch (e) { st.textContent = 'خطأ في البحث'; }
  btn.disabled = false;
}

function posterUrl(p) {
  if (!p) return '';
  if (p.startsWith('http')) return p.replace('http://', 'https://').replace('/w500/', '/w300/');
  return 'https://image.tmdb.org/t/p/w300' + p;
}

function render(movies) {
  res.innerHTML = '';
  for (const m of movies) {
    const poster = posterUrl(m.poster_path);
    const year = (m.release_date || '').slice(0, 4);
    const el = document.createElement('div');
    el.className = 'movie';
    el.innerHTML = \`
      <img src="\${poster}" onerror="this.style.display='none'" alt="">
      <div class="info">
        <div class="t">\${esc(m.title)}</div>
        <div class="y">\${year || ''}</div>
        <div class="l">اضغط للتشغيل ▶</div>
      </div>\`;
    el.addEventListener('click', () => openMovie(m));
    res.appendChild(el);
  }
}

let opening = false;
async function openMovie(m) {
  if (opening) return;
  opening = true;
  st.textContent = 'جاري تجهيز الروابط (ثواني)...';
  try {
    const r = await fetch('/api/extract?id=' + m.id + '&title=' + encodeURIComponent(m.title));
    const data = await r.json();
    if (data.links && data.links.length) {
      location.href = '/watch?title=' + encodeURIComponent(m.title) + '&id=' + m.id;
    } else {
      st.textContent = 'مفيش روابط شغالة لهذا الفيلم';
    }
  } catch (e) { st.textContent = 'خطأ في الاستخراج'; }
  opening = false;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
</script>
</body>
</html>`;

const WATCH_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{title}} | 7esen HD</title>
<style>
:root { --bg:#0b0d12; --card:#141823; --border:#232a3a; --text:#e8ecf4; --dim:#8b93a7; --accent:#ff434c; --accent2:#6c5ce7; }
* { box-sizing:border-box; margin:0; padding:0; }
body { background:var(--bg); color:var(--text); font-family:'Segoe UI',Tahoma,sans-serif; min-height:100vh; }
.top { display:flex; align-items:center; gap:14px; padding:16px 22px; border-bottom:1px solid var(--border); }
.top a { color:var(--accent); text-decoration:none; font-size:15px; font-weight:bold; }
.top h1 { font-size:18px; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.wrap { max-width:1100px; margin:20px auto; padding:0 16px; }
.player-box { border-radius:14px; overflow:hidden; border:1px solid var(--border); background:#000; position:relative; aspect-ratio:16/9; cursor:pointer; }
video { width:100%; height:100%; display:block; background:#000; outline:none; }

.center-play { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:80px; height:80px; border-radius:50%; border:none; background:rgba(255,67,76,.92); color:#fff; font-size:30px; cursor:pointer; z-index:5; transition:transform .15s, opacity .2s; box-shadow:0 8px 30px rgba(255,67,76,.4); }
.center-play:hover { transform:translate(-50%,-50%) scale(1.08); }
.center-play.hidden { opacity:0; pointer-events:none; }

.controls { position:absolute; inset:auto 0 0 0; padding:60px 16px 12px; background:linear-gradient(to top, rgba(0,0,0,.85), transparent); display:flex; align-items:center; gap:12px; opacity:0; transition:opacity .25s; z-index:4; }
.controls.visible { opacity:1; }
.ic { width:36px; height:36px; flex:0 0 auto; border:none; background:transparent; color:#fff; font-size:19px; cursor:pointer; border-radius:8px; line-height:36px; text-align:center; padding:0; }
.ic:hover { background:rgba(255,255,255,.14); }
#bar { flex:1; -webkit-appearance:none; appearance:none; height:5px; border-radius:3px; background:rgba(255,255,255,.25); cursor:pointer; outline:none; }
#bar::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:var(--accent); border:none; }
#bar::-moz-range-thumb { width:14px; height:14px; border-radius:50%; background:var(--accent); border:none; }
.time { font-size:12px; color:#ddd; direction:ltr; white-space:nowrap; }
.menu-wrap { position:relative; }
.menu { position:absolute; bottom:44px; right:0; background:rgba(10,12,18,.96); border:1px solid var(--border); border-radius:12px; padding:8px; min-width:150px; display:none; flex-direction:column; gap:4px; z-index:10; box-shadow:0 10px 30px rgba(0,0,0,.6); }
.menu.open { display:flex; }
.menu .mi { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 12px; border-radius:8px; border:none; background:transparent; color:var(--text); font-size:13px; cursor:pointer; text-align:right; width:100%; }
.menu .mi:hover { background:rgba(255,255,255,.08); }
.menu .mi.active { color:var(--accent); font-weight:bold; }
.menu .mi .chk { color:var(--accent); font-size:15px; }
.hint { position:absolute; bottom:52px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,.8); color:#fff; font-size:12px; padding:6px 12px; border-radius:8px; opacity:0; transition:opacity .2s; pointer-events:none; white-space:nowrap; z-index:11; }
.hint.show { opacity:1; }
.spin { width:54px; height:54px; border:4px solid rgba(255,255,255,.2); border-top-color:var(--accent); border-radius:50%; position:absolute; top:50%; left:50%; margin:-27px 0 0 -27px; animation:rot .9s linear infinite; display:none; z-index:3; }
@keyframes rot { to { transform:rotate(360deg); } }
#err { display:none; text-align:center; color:var(--accent); padding:40px 0; font-size:16px; }
#qcur { font-size:11px; color:#bbb; direction:ltr; }
</style>
</head>
<body>
<div class="top">
  <a href="/">← بحث جديد</a>
  <h1>{{title}}</h1>
</div>
<div class="wrap">
  <div id="err">مفيش روابط شغالة</div>
  <div class="player-box" id="box">
    <video id="player" playsinline preload="metadata"></video>
    <button class="center-play" id="bigplay">▶</button>
    <div class="spin" id="spin"></div>
    <div class="hint" id="hint"></div>
    <div class="controls" id="controls">
      <button class="ic" id="play">▶</button>
      <input type="range" id="bar" min="0" max="100" value="0" step="0.1">
      <span class="time" id="tcur">0:00</span>
      <span class="time">/</span>
      <span class="time" id="tdur">0:00</span>
      <span class="ic" id="qcur"></span>
      <div class="menu-wrap" id="qwrap">
        <button class="ic" id="qbtn" title="الجودة">⛭</button>
        <div class="menu" id="qmenu"></div>
      </div>
      <div class="menu-wrap" id="swrap">
        <button class="ic" id="sbtn" title="السرعة">▶▶</button>
        <div class="menu" id="smenu"></div>
      </div>
      <button class="ic" id="pip" title="نافذة صغيرة">▣</button>
      <button class="ic" id="full" title="ملء الشاشة">⛶</button>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js"></script>
<script>
const links = {{links}};
let hls = null, curTag = null, hideTimer = null, pausedByUser = true;
const video = document.getElementById('player');
const box = document.getElementById('box');
const err = document.getElementById('err');
const spin = document.getElementById('spin');
const ctr = document.getElementById('controls');
const big = document.getElementById('bigplay');
const hint = document.getElementById('hint');
const bar = document.getElementById('bar');
const tcur = document.getElementById('tcur');
const tdur = document.getElementById('tdur');
const qcur = document.getElementById('qcur');

function fmt(s) { if (!isFinite(s)) return '0:00'; s = Math.floor(s); const m = Math.floor(s/60), sec = s%60; return m + ':' + String(sec).padStart(2,'0'); }
function showSpin(on) { spin.style.display = on ? 'block' : 'none'; }
function showHint(t) { hint.textContent = t; hint.classList.add('show'); clearTimeout(showHint._t); showHint._t = setTimeout(() => hint.classList.remove('show'), 1600); }
function showControls() {
  ctr.classList.add('visible'); big.classList.add('hidden');
  clearTimeout(hideTimer);
  if (!video.paused) hideTimer = setTimeout(() => ctr.classList.remove('visible'), 2800);
}
function showBig() {
  if (video.paused) { big.textContent = '▶'; big.classList.remove('hidden'); }
  else big.classList.add('hidden');
}

function toggleMenu(menu, btn) {
  document.querySelectorAll('.menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
  menu.classList.toggle('open');
}
document.querySelectorAll('.menu-wrap').forEach(w => {
  w.querySelector('.ic').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu(w.querySelector('.menu'));
  });
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-wrap')) document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open'));
});

function load(src) {
  showSpin(true);
  if (hls) { hls.destroy(); hls = null; }
  video.pause();
  video.removeAttribute('src');
  video.load();
  big.classList.remove('hidden');
  pausedByUser = true;
  if (Hls.isSupported()) {
    hls = new Hls({ enableWorker: true, maxBufferLength: 30, maxMaxBufferLength: 60, startLevel: -1 });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (evt, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { showSpin(true); hls.startLoad(); }
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
      }
    });
    hls.on(Hls.Events.LEVEL_SWITCHED, (e, d) => {
      const lv = hls.levels[d.level];
      if (lv && lv.height) qcur.textContent = lv.height + 'p';
    });
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      showSpin(false);
      tdur.textContent = fmt(hls.levels[hls.currentLevel] ? hls.levels[hls.currentLevel].details ? hls.levels[hls.currentLevel].details.totalduration : 0 : 0);
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src; showSpin(false);
  } else {
    err.style.display = 'block'; err.textContent = 'المتصفح لا يدعم HLS'; showSpin(false);
  }
}

function togglePlay() {
  if (video.paused) {
    pausedByUser = false;
    video.play().catch(() => {});
  } else {
    pausedByUser = true;
    video.pause();
  }
}
big.addEventListener('click', togglePlay);
document.getElementById('play').addEventListener('click', togglePlay);
box.addEventListener('click', (e) => {
  if (e.target.closest('.menu-wrap') || e.target.closest('#bar') || e.target === big) return;
  togglePlay();
});
box.addEventListener('dblclick', () => { fullscreen(); });

video.addEventListener('playing', () => { showSpin(false); showControls(); });
video.addEventListener('waiting', () => { if (!video.paused) showSpin(true); });
video.addEventListener('pause', () => showBig());
video.addEventListener('play', () => { showBig(); showControls(); });
video.addEventListener('timeupdate', () => {
  if (video.duration) bar.value = (video.currentTime / video.duration) * 100;
  tcur.textContent = fmt(video.currentTime);
});
video.addEventListener('loadedmetadata', () => { tdur.textContent = fmt(video.duration); });

bar.addEventListener('input', () => {
  if (video.duration) video.currentTime = (bar.value / 100) * video.duration;
});

const qmenu = document.getElementById('qmenu');
for (const l of links) {
  const b = document.createElement('button');
  b.className = 'mi';
  b.dataset.q = l.tag;
  b.innerHTML = l.label + '<span class="chk"></span>';
  b.addEventListener('click', () => {
    curTag = l.tag;
    qmenu.querySelectorAll('.mi').forEach(m => m.classList.toggle('active', m.dataset.q === l.tag));
    document.querySelectorAll('#qmenu .chk').forEach(c => c.textContent = '');
    b.querySelector('.chk').textContent = '✓';
    qmenu.classList.remove('open');
    showHint('جودة: ' + l.label);
    load(l.url);
  });
  qmenu.appendChild(b);
}
qmenu.firstChild && qmenu.firstChild.classList.add('active');
qmenu.firstChild && (qmenu.firstChild.querySelector('.chk').textContent = '✓');

const smenu = document.getElementById('smenu');
for (const sp of [0.5, 1, 1.5, 2]) {
  const b = document.createElement('button');
  b.className = 'mi';
  b.dataset.sp = sp;
  b.innerHTML = sp + 'x<span class="chk"></span>';
  if (sp === 1) { b.classList.add('active'); b.querySelector('.chk').textContent = '✓'; }
  b.addEventListener('click', () => {
    video.playbackRate = sp;
    smenu.querySelectorAll('.mi').forEach(m => m.classList.toggle('active', m.dataset.sp == sp));
    document.querySelectorAll('#smenu .chk').forEach(c => c.textContent = '');
    b.querySelector('.chk').textContent = '✓';
    smenu.classList.remove('open');
    showHint('السرعة: ' + sp + 'x');
  });
  smenu.appendChild(b);
}

document.getElementById('pip').addEventListener('click', async () => {
  try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await video.requestPictureInPicture(); } catch (e) {}
});
function fullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else box.requestFullscreen().catch(() => {});
}
document.getElementById('full').addEventListener('click', fullscreen);

box.addEventListener('mousemove', showControls);
box.addEventListener('touchstart', () => showControls(), { passive: true });
document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement) showControls(); });

const first = links.find(x => x.tag === 'master') || links[0];
curTag = first.tag;
load(first.url);
</script>
</body>
</html>`;

function score(u) {
  if (u.includes("master")) return 5;
  const qs = ["1080", "720", "480", "360"];
  for (let i = 0; i < qs.length; i++) if (u.includes(qs[i])) return 4 - i;
  return 0;
}

function buildLinksExt(entries) {
  return entries
    .slice()
    .sort((a, b) => score(b.embed) - score(a.embed))
    .map((e) => {
      const t = (e.headers && e.headers._tag) || (e.embed.includes("master") ? "master" : "360");
      const tag = t === "master" ? "master" : t;
      const label = tag === "master" ? "جودة تلقائية (master)" : tag + "p";
      return { url: "/s/" + makeToken(e.embed, e.headers), tag, label };
    });
}

function buildLinks(m3u8s) {
  return m3u8s
    .slice()
    .sort((a, b) => score(b) - score(a))
    .map((u) => {
      let tag, label;
      if (u.includes("master")) { tag = "master"; label = "جودة تلقائية (master)"; }
      else if (u.includes("1080")) { tag = "1080"; label = "1080p"; }
      else if (u.includes("720")) { tag = "720"; label = "720p"; }
      else if (u.includes("480")) { tag = "480"; label = "480p"; }
      else { tag = "360"; label = "360p"; }
      return { url: "/s/" + makeToken(u), tag, label };
    });
}

async function apiSearch(q) {
  const bases = [API, ...BACKUPS];
  const errs = [];
  for (const base of bases) {
    try {
      const url = base + "search/" + encodeURIComponent(q) + "/" + CODE;
      const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
      if (!r.ok) { errs.push(host(base) + " HTTP " + r.status); continue; }
      const data = await r.json();
      const found = (data.search || []).filter((m) => String(m.type || "").toLowerCase() === "movie");
      if (found.length) return { results: found, server: host(base) };
      errs.push(host(base) + " فارغ");
    } catch (e) {
      errs.push(host(base) + " " + String(e.message || e));
    }
  }
  throw new Error("كل السيرفرات فشلت: " + errs.join(" | "));
}

function host(base) {
  try { return new URL(base).host; } catch { return base; }
}

async function siteSearch(q) {
  const r = await fetch(SITE + "/?s=" + encodeURIComponent(q), { headers: HEADERS });
  if (!r.ok) return [];
  const text = await r.text();
  const links = [];
  for (const m of text.matchAll(/href="([^"]*\/movies\/[^"]*)"/g)) {
    const l = m[1].split("&")[0];
    if (!links.includes(l)) links.push(l);
  }
  return links;
}

async function verifyM3u8(url, extra) {
  try {
    const r = await fetch(url, { headers: { ...CDN_HEADERS, ...(extra || {}) }, signal: AbortSignal.timeout(15000) });
    const buf = Buffer.from(await r.arrayBuffer());
    return r.ok && buf.subarray(0, 7).toString() === "#EXTM3U";
  } catch {
    return false;
  }
}

async function getApiToken(base) {
  if (tokCache.has(base)) return tokCache.get(base);
  const name = "hd" + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
  const email = name + "@t.co";
  const body = "name=" + encodeURIComponent(name) + "&email=" + encodeURIComponent(email) +
    "&password=Test1234!&password_confirmation=Test1234!";
  const r = await fetch(base + "register", {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("register " + r.status);
  const j = await r.json();
  const tok = j && j.access_token;
  if (!tok) throw new Error("no token");
  tokCache.set(base, tok);
  return tok;
}

async function apiDetail(id, base) {
  const tok = await getApiToken(base);
  const r = await fetch(base + "media/detail/" + encodeURIComponent(id) + "/" + CODE, {
    headers: { ...HEADERS, Authorization: "Bearer " + tok },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("detail " + r.status);
  const j = await r.json();
  return (j.videos || []).filter((v) => v && v.link && v.status === 1 && !v.downloadonly);
}

async function resolveEmbed(pageUrl, opts) {
  const ua = (opts && opts.ua) || UA;
  const ref = (opts && opts.referer) || new URL(pageUrl).origin + "/";
  const r = await fetch(pageUrl, {
    headers: { "User-Agent": ua, Referer: ref, "Accept-Language": "ar,en;q=0.9" },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("embed " + r.status);
  const text = await r.text();
  const urls = resolvePlayerM3u8(text, pageUrl);
  const cookies = [...text.matchAll(/\$\.cookie\(\s*'([^']+)'\s*,\s*'([^']+)'/g)].map((m) => m[1] + "=" + m[2]).join("; ");
  return { urls, cookies };
}

async function extractFromEmbed(pageUrl, v) {
  const ua = (v && v.useragent) || UA;
  const ref = (v && v.header) || new URL(pageUrl).origin + "/";
  const { urls, cookies } = await resolveEmbed(pageUrl, { ua, referer: ref });
  const origin = new URL(pageUrl).origin;
  const eb = { Referer: origin + "/", Cookie: cookies, "User-Agent": ua, _embed: 1 };
  for (const u of urls) {
    if (await verifyM3u8(u, eb)) {
      let tag = u.includes("1080") ? "1080" : u.includes("720") ? "720" : u.includes("480") ? "480" : u.includes("360") ? "360" : "master";
      return { embed: pageUrl, headers: { ...eb, _tag: tag } };
    }
  }
  return null;
}

async function extractApiLinks(id) {
  const errs = [];
  for (const base of [API, ...BACKUPS]) {
    let videos = [];
    try {
      videos = await apiDetail(id, base);
    } catch (e) {
      errs.push(host(base) + " " + String(e.message || e));
      continue;
    }
    if (!videos.length) { errs.push(host(base) + " بلا روابط"); continue; }
    const out = [];
    for (const v of videos.slice(0, 12)) {
      try {
        const found = await extractFromEmbed(v.link, v);
        if (found && !out.some((x) => x.embed === found.embed)) out.push(found);
      } catch {
        /* host غير متاح */
      }
    }
    if (out.length) return { links: buildLinksExt(out), server: host(base) };
    errs.push(host(base) + " فشل لليستها");
  }
  throw new Error("روابط التشغيل فشلت: " + errs.slice(0, 5).join(" | "));
}

async function getMovieLinks(movieId, title) {
  try {
    const { links, server } = await extractApiLinks(movieId);
    return { links, server };
  } catch (apiErr) {
    try {
      const siteLinks = await siteSearch(title);
      const pageUrl = siteLinks[0] || SITE + "/?p=" + movieId;
      const m3u8s = await extractFromPage(pageUrl);
      const links = [];
      for (const l of buildLinks(m3u8s)) {
        const tok = l.url.split("/").pop();
        if (await verifyM3u8(resolveToken(tok))) links.push(l);
      }
      return { links, server: host(SITE) };
    } catch (e) {
      throw new Error(String(apiErr.message || apiErr) + " | site: " + String(e.message || e));
    }
  }
}

function rateLimited(ip) {
  const now = Date.now();
  const e = rl.get(ip) || { n: 0, ts: now };
  if (now - e.ts > 60000) { e.n = 0; e.ts = now; }
  e.n += 1;
  rl.set(ip, e);
  return e.n > RATE_MAX;
}

app.get("/", (req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8").send(INDEX_HTML);
});

app.get("/api/search", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json({ results: [] });
  if (!CODE) return res.status(500).json({ error: "FHD_CODE غير مضبوط في الإعدادات" });
  try {
    const { results, server } = await apiSearch(q);
    res.json({ results, server });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

app.get("/api/extract", async (req, res) => {
  const movieId = String(req.query.id || "");
  const title = String(req.query.title || "");
  const ip = (req.headers["x-forwarded-for"] || req.ip || "?").split(",")[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: "تم إرسال طلبات كثيرة، انتظر دقيقة" });

  const cached = cache.get(movieId);
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return res.json({ links: cached.links, server: cached.server });
  }

  try {
    const { links, server } = await getMovieLinks(movieId, title);
    cache.set(movieId, { ts: Date.now(), links, server });
    res.json({ links, server });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

app.get("/s/:token", async (req, res) => {
  const full = resolveTokenFull(req.params.token);
  if (!full) return res.status(404).end();
  const { url, headers } = full;
  const hdrs = { ...(headers || CDN_HEADERS) };
  delete hdrs._embed;
  delete hdrs._tag;
  let target = url;
  if (headers && headers._embed) {
    try {
      const { urls, cookies } = await resolveEmbed(target, { ua: hdrs["User-Agent"] });
      if (cookies) hdrs.Cookie = cookies;
      let ok = false;
      for (const u of urls) {
        if (await verifyM3u8(u, hdrs)) { target = u; ok = true; break; }
      }
      if (!ok) return res.status(502).end();
    } catch {
      return res.status(502).end();
    }
  }
  let r;
  try {
    r = await fetch(target, { headers: hdrs, signal: AbortSignal.timeout(30000) });
  } catch {
    return res.status(502).end();
  }
  if (!r.ok) return res.status(r.status).end();
  const body = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get("content-type") || "";

  const isPlaylist = body.subarray(0, 7).toString() === "#EXTM3U" || target.includes("m3u8") || ct.includes("mpegurl") || ct.includes("playlist");
  if (isPlaylist) {
    const text = body.toString("utf8");
    const lines = text.split(/\r?\n/).map((line) => {
      if (line.startsWith("#") || !line.trim()) return line;
      const seg = new URL(line.trim(), target).toString();
      return "/s/" + makeToken(seg, hdrs);
    });
    res.set("Content-Type", "application/vnd.apple.mpegurl");
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "no-cache");
    return res.send(lines.join("\n"));
  }

  res.set("Content-Type", target.includes(".ts") ? "video/mp2t" : ct || "application/octet-stream");
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Cache-Control", "no-cache");
  res.send(body);
});

app.get("/watch", async (req, res) => {
  const title = String(req.query.title || "فيلم");
  const movieId = String(req.query.id || "");
  let links = cache.get(movieId)?.links || [];
  let server = cache.get(movieId)?.server;
  if (!links.length && movieId) {
    try {
      const got = await getMovieLinks(movieId, title);
      links = got.links;
      server = got.server;
      if (links.length) cache.set(movieId, { ts: Date.now(), links, server });
    } catch (e) {
      return res.status(502).send("خطأ في تجهيز الروابط: " + String(e.message || e));
    }
  }
  if (!links.length) return res.status(404).send("لا توجد روابط");
  res.set("Content-Type", "text/html; charset=utf-8").send(
    WATCH_HTML.replace("{{title}}", title.replace(/</g, "&lt;")).replace("{{links}}", JSON.stringify(links))
  );
});

module.exports = app;
