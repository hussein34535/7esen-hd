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
const detailCache = new Map();
const CACHE_MS = 1800 * 1000;
const DETAIL_MS = 15 * 60 * 1000;
const RATE_MAX = 5;

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>7esen HD | بث مباشر</title>
<style>
:root { --bg:#0a0b10; --card:#13151d; --border:rgba(255,255,255,.07); --text:#f2f4f8; --dim:#8b93a7; --accent:#e50914; --accent2:#6c5ce7; }
* { box-sizing:border-box; margin:0; padding:0; }
body { background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; min-height:100vh; }
header { padding:54px 22px 34px; text-align:center; background:radial-gradient(1200px 420px at 50% -120px, rgba(229,9,20,.16), transparent 70%); border-bottom:1px solid var(--border); }
header h1 { font-size:30px; letter-spacing:-.5px; font-weight:800; }
header h1 span { color:var(--accent); }
header p { color:var(--dim); font-size:14px; margin-top:8px; }
.search-wrap { max-width:620px; margin:-22px auto 0; padding:0 16px; position:relative; z-index:2; }
.search-box { display:flex; gap:10px; background:var(--card); border:1px solid var(--border); border-radius:16px; padding:8px; box-shadow:0 18px 50px rgba(0,0,0,.55); }
.search-box input { flex:1; padding:12px 14px; border:none; background:transparent; color:var(--text); font-size:16px; outline:none; }
.search-box input::placeholder { color:var(--dim); }
.search-box button { padding:12px 26px; border:none; border-radius:12px; background:var(--accent); color:#fff; font-size:15px; font-weight:700; cursor:pointer; transition:filter .15s; }
.search-box button:hover { filter:brightness(1.12); }
.search-box button:disabled { opacity:.5; cursor:wait; }
#status { text-align:center; color:var(--dim); margin:18px 0 6px; font-size:14px; }
#results { max-width:1060px; margin:18px auto 60px; padding:0 16px; display:grid; grid-template-columns:repeat(auto-fill,minmax(168px,1fr)); gap:18px; }
.movie { background:var(--card); border:1px solid var(--border); border-radius:16px; overflow:hidden; cursor:pointer; transition:transform .18s, box-shadow .18s; }
.movie:hover { transform:translateY(-4px); box-shadow:0 14px 34px rgba(0,0,0,.5); }
.movie img { width:100%; aspect-ratio:2/3; object-fit:cover; background:#000; display:block; }
.movie .info { padding:10px 12px 12px; }
.movie .info .t { font-size:14px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.movie .info .y { color:var(--dim); font-size:12px; margin-top:3px; }
.movie .info .l { color:var(--accent2); font-size:11px; margin-top:5px; font-weight:600; }
.hint { text-align:center; color:var(--dim); margin-top:80px; font-size:15px; }
.hint b { color:var(--accent); }
@media (max-width:640px) {
  header { padding:44px 18px 40px; }
  header h1 { font-size:24px; }
  #results { grid-template-columns:repeat(3,1fr); gap:8px; padding:0 10px; }
  .movie { border-radius:10px; }
  .movie img { aspect-ratio:1/1; }
  .movie .info { padding:6px 8px 8px; }
  .movie .info .t { font-size:11px; }
  .movie .info .y, .movie .info .l { display:none; }
}
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
:root { --bg:#0a0b10; --card:#13151d; --border:rgba(255,255,255,.07); --text:#f2f4f8; --dim:#8b93a7; --accent:#e50914; --accent2:#6c5ce7; }
* { box-sizing:border-box; margin:0; padding:0; }
body { background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; min-height:100vh; }
.top { display:flex; align-items:center; gap:12px; padding:14px 20px; border-bottom:1px solid var(--border); position:sticky; top:0; background:rgba(10,11,16,.9); backdrop-filter:blur(12px); z-index:20; }
.top a { color:var(--text); text-decoration:none; font-size:13px; font-weight:600; padding:8px 14px; border-radius:999px; background:var(--card); border:1px solid var(--border); transition:background .15s; white-space:nowrap; }
.top a:hover { background:#1c1f2a; }
.top h1 { font-size:16px; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.wrap { max-width:1100px; margin:18px auto 50px; padding:0 16px; }
.player-box { border-radius:16px; overflow:hidden; background:#000; position:relative; aspect-ratio:16/9; cursor:pointer; box-shadow:0 26px 80px rgba(0,0,0,.65); }
.player-box:fullscreen { border-radius:0; box-shadow:none; }
video { width:100%; height:100%; display:block; background:#000; outline:none; }

.srvbar { display:flex; flex-wrap:wrap; align-items:center; gap:9px; margin:6px 0 12px; }
.srvbar .lbl { color:var(--dim); font-size:12px; margin-left:4px; }
.chip { min-width:42px; height:42px; padding:0 15px; border-radius:13px; border:1px solid var(--border); background:var(--card); color:var(--text); font-size:15px; font-weight:700; cursor:pointer; transition:background .15s, border-color .15s, color .15s, transform .12s, box-shadow .15s; }
.chip:hover { transform:translateY(-1px); border-color:rgba(255,255,255,.2); }
.chip.active { background:var(--accent); border-color:var(--accent); color:#fff; box-shadow:0 10px 26px rgba(229,9,20,.35); }
.chip:disabled { opacity:.45; cursor:default; }
.now { color:var(--dim); font-size:12.5px; margin:2px 2px 10px; }
.now b { color:var(--accent); font-weight:700; }
.load { display:flex; flex-direction:column; align-items:center; gap:14px; padding:80px 0; color:var(--dim); }
.load .ld { width:44px; height:44px; border:4px solid rgba(255,255,255,.12); border-top-color:var(--accent); border-radius:50%; animation:rot .9s linear infinite; }

.center-play { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:84px; height:84px; border-radius:50%; border:none; background:rgba(229,9,20,.94); color:#fff; font-size:32px; cursor:pointer; z-index:5; transition:transform .15s, opacity .2s; box-shadow:0 12px 40px rgba(229,9,20,.5); }
.center-play:hover { transform:translate(-50%,-50%) scale(1.07); }
.center-play.hidden { opacity:0; pointer-events:none; }

.controls { position:absolute; inset:auto 0 0 0; padding:64px 16px 12px; background:linear-gradient(to top, rgba(0,0,0,.9), transparent); display:flex; align-items:center; gap:12px; opacity:0; transition:opacity .25s; z-index:4; }
.controls.visible { opacity:1; }
.ic { width:38px; height:38px; flex:0 0 auto; border:none; background:transparent; color:#fff; font-size:19px; cursor:pointer; border-radius:10px; line-height:38px; text-align:center; padding:0; }
.ic:hover { background:rgba(255,255,255,.14); }
#bar { flex:1; -webkit-appearance:none; appearance:none; height:4px; border-radius:2px; cursor:pointer; outline:none; background:linear-gradient(to right, var(--accent) 0, var(--accent) var(--prog,0%), rgba(255,255,255,.16) var(--prog,0%), rgba(255,255,255,.16) var(--buf,100%), rgba(255,255,255,.07) var(--buf,100%)); }
#bar::-moz-range-track { height:4px; border-radius:2px; background:rgba(255,255,255,.07); }
#bar::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:var(--accent); border:none; box-shadow:0 0 8px rgba(229,9,20,.6); }
#bar::-moz-range-thumb { width:14px; height:14px; border-radius:50%; background:var(--accent); border:none; }
.time { font-size:12px; color:#ddd; direction:ltr; white-space:nowrap; }
.menu-wrap { position:relative; }
.menu { position:absolute; bottom:46px; right:0; background:rgba(12,14,20,.97); border:1px solid var(--border); border-radius:14px; padding:8px; min-width:170px; display:none; flex-direction:column; gap:4px; z-index:12; box-shadow:0 16px 44px rgba(0,0,0,.7); backdrop-filter:blur(14px); }
.menu.open { display:flex; }
.menu .mi { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:9px 12px; border-radius:9px; border:none; background:transparent; color:var(--text); font-size:13px; cursor:pointer; text-align:right; width:100%; }
.menu .mi:hover { background:rgba(255,255,255,.08); }
.menu .mi.active { color:var(--accent); font-weight:700; }
.menu .mi .chk { color:var(--accent); font-size:15px; }
.menu .mi .sub { color:var(--dim); font-size:11px; font-weight:400; }
.hint { position:absolute; bottom:54px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,.82); color:#fff; font-size:12px; padding:6px 12px; border-radius:10px; opacity:0; transition:opacity .2s; pointer-events:none; white-space:nowrap; z-index:11; }
.hint.show { opacity:1; }
.spin { width:56px; height:56px; border:4px solid rgba(255,255,255,.18); border-top-color:var(--accent); border-radius:50%; position:absolute; top:50%; left:50%; margin:-28px 0 0 -28px; animation:rot .9s linear infinite; display:none; z-index:3; }
@keyframes rot { to { transform:rotate(360deg); } }
#err { display:none; text-align:center; color:var(--accent); padding:40px 0; font-size:16px; }
#qcur { font-size:11px; color:#bbb; direction:ltr; background:rgba(255,255,255,.08); border-radius:8px; height:38px; line-height:38px; width:auto; padding:0 10px; }
</style>
</head>
<body>
<div class="top">
  <a href="/">← بحث جديد</a>
  <h1>{{title}}</h1>
</div>
<div class="wrap">
  <div class="load" id="load">
    <div class="ld"></div>
    <div id="loadmsg">جاري تجهيز الروابط من كل السيرفرات، لحظة واحدة...</div>
  </div>
  <div id="err">مفيش روابط شغالة</div>
  <div style="display:none" id="stage">
    <div class="srvbar" id="srvbar"><span class="lbl">السيرفر:</span></div>
    <div class="now" id="now"></div>
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
</div>

<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js"></script>
<script>
const TITLE = {{titleJson}};
const VID = {{vidJson}};
const INIT = {{init}};
let DATA = null, hls = null, curLink = null, hideTimer = null;
let resumeAt = 0, autoplayNext = false, resumeDone = false, switching = false, scrubbing = false;
const failed = new Set();
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
const srvbar = document.getElementById('srvbar');
const nowEl = document.getElementById('now');
const loadBox = document.getElementById('load');
const stage = document.getElementById('stage');
const qmenu = document.getElementById('qmenu');
const playBtn = document.getElementById('play');

function esc(s){ return String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(s) { if (!isFinite(s)) return '0:00'; s = Math.floor(s); const m = Math.floor(s/60), sec = s%60; return m + ':' + String(sec).padStart(2,'0'); }
function showSpin(on) { spin.style.display = on ? 'block' : 'none'; }
function showHint(t) { hint.textContent = t; hint.classList.add('show'); clearTimeout(showHint._t); showHint._t = setTimeout(() => hint.classList.remove('show'), 1600); }
function showControls() {
  ctr.classList.add('visible'); big.classList.add('hidden');
  clearTimeout(hideTimer);
  if (!video.paused) hideTimer = setTimeout(() => ctr.classList.remove('visible'), 2800);
}
function showBig() {
  syncPlayIcon();
  if (video.paused) { big.textContent = '▶'; big.classList.remove('hidden'); }
  else big.classList.add('hidden');
}

function syncPlayIcon() { playBtn.textContent = video.paused ? '▶' : '⏸'; }

function paintBar() {
  const d = video.duration || 0;
  const prog = d ? (video.currentTime / d) * 100 : 0;
  let buf = prog;
  if (d && video.buffered && video.buffered.length) {
    const end = video.buffered.end(video.buffered.length - 1);
    buf = Math.max(buf, (end / d) * 100);
  }
  bar.style.setProperty('--prog', prog.toFixed(2) + '%');
  bar.style.setProperty('--buf', Math.min(100, buf).toFixed(2) + '%');
}

document.querySelectorAll('.menu-wrap').forEach(w => {
  w.querySelector('.ic').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = w.querySelector('.menu');
    document.querySelectorAll('.menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
    menu.classList.toggle('open');
  });
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-wrap')) document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open'));
});

function showLoad(on, msg) {
  loadBox.style.display = on ? 'flex' : 'none';
  if (msg) loadBox.querySelector('#loadmsg').textContent = msg;
}

function boot() {
  if (INIT && INIT.length) {
    DATA = { servers: INIT };
    showLoad(false);
    render();
    return;
  }
  showLoad(true);
  const u = '/api/watch?id=' + encodeURIComponent(VID) + '&title=' + encodeURIComponent(TITLE);
  (function tryFetch(tries) {
    fetch(u)
      .then(r => r.json())
      .then(j => {
        if (j.error) throw new Error(j.error);
        DATA = j;
        if (!DATA.servers || !DATA.servers.length) throw new Error('مفيش روابط من أي سيرفر');
        showLoad(false);
        render();
      })
      .catch(e => {
        if (tries < 3 && String(e.message).indexOf('كثيرة') > -1) {
          setTimeout(() => tryFetch(tries + 1), 2500);
          return;
        }
        showLoad(false);
        err.style.display = 'block';
        err.textContent = 'مفيش روابط شغالة: ' + String(e.message || e);
      });
  })(0);
}

function render() {
  srvbar.innerHTML = '<span class="lbl">السيرفر:</span>';
  DATA.servers.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'chip srv';
    b.dataset.i = i;
    b.textContent = String(i + 1);
    b.title = s.name + ' (' + s.links.length + ' روابط)';
    b.addEventListener('click', () => setServer(i));
    srvbar.appendChild(b);
  });
  stage.style.display = 'block';
  setServer(0);
}

function setServer(i) {
  srvbar.querySelectorAll('.srv').forEach(c => c.classList.toggle('active', Number(c.dataset.i) === i));
  const sv = DATA.servers[i];
  qmenu.innerHTML = '';
  sv.links.forEach(l => {
    const b = document.createElement('button');
    b.className = 'mi';
    b.dataset.u = l.url;
    b.innerHTML = esc(l.label) + '<span class="chk"></span>';
    b.addEventListener('click', () => {
      loadLink(i, l);
      qmenu.classList.remove('open');
    });
    qmenu.appendChild(b);
  });
  const first = sv.links.find(l => l.tag === 'master' || l.tag === 'auto') || sv.links[0];
  loadLink(i, first);
}

function loadLink(i, l, auto) {
  if (auto !== true) failed.delete(DATA.servers[i].name + '|' + l.url);
  curLink = l;
  qmenu.querySelectorAll('.mi').forEach(m => m.classList.toggle('active', m.dataset.u === l.url));
  qmenu.querySelectorAll('.chk').forEach(c => c.textContent = '');
  const cur = qmenu.querySelector('button[data-u="' + l.url + '"] .chk');
  if (cur) cur.textContent = '✓';
  nowEl.innerHTML = 'السيرفر <b>' + (i + 1) + '</b> — ' + esc(DATA.servers[i].name) + ' • ' + esc(l.label);
  switching = true;
  if (video.duration && isFinite(video.duration) && video.duration > 0 && video.readyState >= 1) {
    resumeAt = video.currentTime;
    autoplayNext = !video.paused;
  } else {
    resumeAt = 0;
    autoplayNext = false;
  }
  resumeDone = false;
  load(l.url);
}

function nextTry() {
  for (const s of DATA.servers) {
    for (const l of s.links) {
      const k = s.name + '|' + l.url;
      if (!failed.has(k)) {
        failed.add(k);
        showHint('بنحاول سيرفر/رابط تاني...');
        loadLink(DATA.servers.indexOf(s), l, true);
        return;
      }
    }
  }
  err.style.display = 'block';
  err.textContent = 'كل الروابط فشلت مؤقتًا، جرب فيلم تاني';
}

function tryResume() {
  if (resumeDone) return;
  if (!(video.duration && isFinite(video.duration) && video.duration > 0)) return;
  if (resumeAt > 0 && resumeAt < video.duration - 2) {
    try { video.currentTime = resumeAt; paintBar(); } catch (e) {}
  }
  resumeDone = true;
  switching = false;
  if (autoplayNext && video.paused) {
    video.play().catch(() => { switching = false; showBig(); });
  }
  showControls();
}

function load(src) {
  showSpin(true);
  switching = true;
  if (hls) { hls.destroy(); hls = null; }
  video.pause();
  video.removeAttribute('src');
  video.load();
  big.classList.remove('hidden');
  syncPlayIcon();
  if (Hls.isSupported()) {
    hls = new Hls({ enableWorker: true, maxBufferLength: 30, maxMaxBufferLength: 60, startLevel: -1 });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (evt, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hls._f = (hls._f || 0) + 1;
        if (hls._f >= 2) { hls._f = 0; nextTry(); }
        else { showSpin(true); hls.startLoad(); }
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
      }
    });
    hls.on(Hls.Events.LEVEL_SWITCHED, (e, d) => {
      const lv = hls.levels[d.level];
      if (lv && lv.height) qcur.textContent = lv.height + 'p';
    });
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      hls._f = 0;
      showSpin(false);
      tryResume();
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src; showSpin(false); tryResume();
  } else {
    err.style.display = 'block'; err.textContent = 'المتصفح لا يدعم HLS'; showSpin(false);
  }
}

function togglePlay() {
  if (video.paused) video.play().catch(() => {});
  else video.pause();
}
big.addEventListener('click', togglePlay);
playBtn.addEventListener('click', togglePlay);
box.addEventListener('click', (e) => {
  if (e.target.closest('.menu-wrap') || e.target.closest('#bar') || e.target === big) return;
  togglePlay();
});
box.addEventListener('dblclick', () => { fullscreen(); });

video.addEventListener('playing', () => { showSpin(false); showControls(); });
video.addEventListener('waiting', () => { if (!video.paused) showSpin(true); });
video.addEventListener('pause', () => { if (!switching) showBig(); });
video.addEventListener('play', () => { showBig(); showControls(); });
video.addEventListener('timeupdate', () => {
  if (!scrubbing) paintBar();
  tcur.textContent = fmt(video.currentTime);
});
video.addEventListener('progress', paintBar);
video.addEventListener('seeked', paintBar);
video.addEventListener('durationchange', () => { tdur.textContent = fmt(video.duration); paintBar(); });
video.addEventListener('loadedmetadata', () => { tdur.textContent = fmt(video.duration); tryResume(); });
video.addEventListener('canplay', tryResume);

bar.addEventListener('pointerdown', () => { scrubbing = true; });
bar.addEventListener('input', () => {
  if (video.duration) video.currentTime = (bar.value / 100) * video.duration;
  if (scrubbing) bar.style.setProperty('--prog', bar.value + '%');
});
const endScrub = () => { scrubbing = false; paintBar(); };
bar.addEventListener('pointerup', endScrub);
bar.addEventListener('pointercancel', endScrub);

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

boot();
</script>
</body>
</html>`;

function score(u) {
  if (u.includes("master")) return 5;
  const qs = ["1080", "720", "480", "360"];
  for (let i = 0; i < qs.length; i++) if (u.includes(qs[i])) return 4 - i;
  return 0;
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

function serverKey(base) {
  return (base || "")
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/\/+$/, "")
    .replace(/\/public\/api$/, "");
}

const SERVER_NAMES = {
  "fashd.com/faselhd15": "فاشد",
  "azertyquiz.com/shahed15": "شاهد",
  "hrrejhp.com/mycimaa": "مسيما",
  "hrrejhp.com/mycimajihedv20": "مسيما V20",
  "hrrejgh.com/wecima15": "وي سيما",
  "3echk.com/mortadha": "مرتضى",
  "7odaeg.com/v2": "7odaeg",
  "abcdef.flech.tn/egybestantojdid": "EgyBest جديد"
};

function serverName(base) { return SERVER_NAMES[serverKey(base)] || serverKey(base) || host(base); }

async function pMap(items, fn, n) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const k = i++;
      try { out[k] = { ok: true, v: await fn(items[k]) }; }
      catch (e) { out[k] = { ok: false, e }; }
    }
  }
  if (!items.length) return out;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
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

function stripLang(h) { const x = { ...h }; delete x["Accept-Language"]; return x; }

async function verifyM3u8(url, extra) {
  try {
    const r = await fetch(url, { headers: stripLang({ ...CDN_HEADERS, ...(extra || {}) }), signal: AbortSignal.timeout(15000) });
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
    headers: { "User-Agent": ua, Referer: ref },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("embed " + r.status);
  const text = await r.text();
  const urls = resolvePlayerM3u8(text, pageUrl);
  const cookies = [...text.matchAll(/\$\.cookie\(\s*'([^']+)'\s*,\s*'([^']+)'/g)].map((m) => m[1] + "=" + m[2]).join("; ");
  return { urls, cookies };
}

async function verifyAndLabel(url, extra) {
  const h = stripLang({ ...CDN_HEADERS, ...(extra || {}) });
  const r = await fetch(url, { headers: h, signal: AbortSignal.timeout(15000) });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.subarray(0, 7).toString() !== "#EXTM3U") return null;
  const text = buf.toString("utf8");
  const widths = [...text.matchAll(/RESOLUTION=(\d+)x(\d+)/g)].map((m) => parseInt(m[1], 10));
  const w = widths.length ? Math.max(...widths) : 0;
  let tag = "auto", label = "تلقائي";
  if (w >= 1880) { tag = "1080"; label = "1080p"; }
  else if (w >= 1200) { tag = "720"; label = "720p"; }
  else if (w >= 800) { tag = "480"; label = "480p"; }
  else if (w >= 600) { tag = "360"; label = "360p"; }
  else if (widths.length) { tag = "360"; label = "360p"; }
  return { ok: true, tag, label };
}

async function extractFromEmbed(pageUrl, v) {
  const ua = (v && v.useragent) || UA;
  const ref = (v && v.header) || new URL(pageUrl).origin + "/";
  const { urls, cookies } = await resolveEmbed(pageUrl, { ua, referer: ref });
  const origin = new URL(pageUrl).origin;
  const eb = { Referer: origin + "/", Cookie: cookies, "User-Agent": ua, _embed: 1 };
  for (const u of urls) {
    try {
      const lab = await verifyAndLabel(u, eb);
      if (lab && lab.ok) {
        return { embed: pageUrl, headers: { ...eb, _tag: lab.tag }, label: lab.label };
      }
    } catch {
      /* جرّب الرابط التالي */
    }
  }
  return null;
}

const LINK_ORDER = { auto: 0, "1080": 1, "720": 2, "480": 3, "360": 4 };

async function extractFromServer(base, id) {
  const dk = "d:" + serverKey(base) + ":" + id;
  const dc = detailCache.get(dk);
  let videos;
  if (dc && Date.now() - dc.ts < DETAIL_MS) videos = dc.videos;
  else {
    videos = await apiDetail(id, base);
    detailCache.set(dk, { ts: Date.now(), videos });
  }
  if (!videos.length) return null;
  const res = await pMap(videos.slice(0, 14), (v) => extractFromEmbed(v.link, v), 6);
  const dedup = new Map();
  for (const r of res) {
    if (r.ok && r.v && !dedup.has(r.v.embed)) dedup.set(r.v.embed, r.v);
  }
  const entries = [...dedup.values()]
    .sort((a, b) => (LINK_ORDER[(b.headers && b.headers._tag) || "auto"] ?? 9) - (LINK_ORDER[(a.headers && a.headers._tag) || "auto"] ?? 9))
    .slice(0, 6);
  if (!entries.length) return null;
  return {
    host: serverKey(base),
    name: serverName(base),
    links: entries.map((e) => ({
      url: "/s/" + makeToken(e.embed, e.headers),
      tag: (e.headers && e.headers._tag) || "auto",
      label: e.label || "تلقائي"
    }))
  };
}

async function extractApiLinks(id) {
  const bases = [API, ...BACKUPS];
  const res = await Promise.allSettled(bases.map((b) => extractFromServer(b, id)));
  const servers = [];
  const errs = [];
  res.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) servers.push(r.value);
    else errs.push(serverName(bases[i]) + " " + (r.status === "rejected" ? String((r.reason && r.reason.message) || r.reason) : "بلا روابط"));
  });
  if (!servers.length) throw new Error("كل السيرفرات فشلت: " + errs.slice(0, 5).join(" | "));
  return { servers, errs };
}

async function getMovieLinks(movieId, title) {
  try {
    return await extractApiLinks(movieId);
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
      return { servers: [{ host: serverKey(SITE), name: serverName(SITE), links }], errs: [String(apiErr.message || apiErr)] };
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

async function linksHandler(movieId, title) {
  const cached = cache.get(movieId);
  if (cached && Date.now() - cached.ts < CACHE_MS && cached.servers.length) return cached;
  const got = await getMovieLinks(movieId, title);
  const box = { ts: Date.now(), servers: got.servers, errs: got.errs || [] };
  cache.set(movieId, box);
  return box;
}

function watchJson(got) {
  return {
    servers: got.servers,
    links: got.servers[0] ? got.servers[0].links : [],
    server: got.servers[0] ? got.servers[0].name : ""
  };
}

app.get(["/api/extract", "/api/watch"], async (req, res) => {
  const movieId = String(req.query.id || "");
  const title = String(req.query.title || "");
  if (!movieId) return res.status(400).json({ error: "id مطلوب" });
  const ip = (req.headers["x-forwarded-for"] || req.ip || "?").split(",")[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: "تم إرسال طلبات كثيرة، انتظر دقيقة" });

  try {
    const got = await linksHandler(movieId, title);
    res.json(watchJson(got));
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

app.get("/s/:token", async (req, res) => {
  const full = resolveTokenFull(req.params.token);
  if (!full) return res.status(404).end();
  const { url, headers } = full;
  const hdrs = stripLang(headers || CDN_HEADERS);
  delete hdrs._embed;
  delete hdrs._tag;
  let candidates = [url];
  if (headers && headers._embed) {
    try {
      const { urls, cookies } = await resolveEmbed(url, { ua: hdrs["User-Agent"] });
      if (cookies) hdrs.Cookie = cookies;
      hdrs.Referer = url;
      candidates = urls.length ? urls : [url];
    } catch {
      return res.status(502).end();
    }
  }
  let r = null;
  for (const u of candidates) {
    try {
      const rr = await fetch(u, { headers: hdrs, signal: AbortSignal.timeout(30000) });
      if (!rr.ok) continue;
      r = rr;
      break;
    } catch {
      continue;
    }
  }
  if (!r) return res.status(502).end();
  const body = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get("content-type") || "";

  const isPlaylist = body.subarray(0, 7).toString() === "#EXTM3U" || String(r.url).includes("m3u8") || ct.includes("mpegurl") || ct.includes("playlist");
  if (isPlaylist) {
    const text = body.toString("utf8");
    const lines = text.split(/\r?\n/).map((line) => {
      if (line.startsWith("#") || !line.trim()) return line;
      const seg = new URL(line.trim(), r.url).toString();
      return "/s/" + makeToken(seg, hdrs);
    });
    res.set("Content-Type", "application/vnd.apple.mpegurl");
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "no-cache");
    return res.send(lines.join("\n"));
  }

  res.set("Content-Type", String(r.url).includes(".ts") ? "video/mp2t" : ct || "application/octet-stream");
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Cache-Control", "no-cache");
  res.send(body);
});

app.get("/watch", (req, res) => {
  const title = String(req.query.title || "فيلم");
  const movieId = String(req.query.id || "");
  const cached = cache.get(movieId);
  const init = cached && Date.now() - cached.ts < CACHE_MS && cached.servers.length
    ? JSON.stringify(cached.servers)
    : "null";
  res.set("Content-Type", "text/html; charset=utf-8").send(
    WATCH_HTML
      .replace("{{title}}", title.replace(/</g, "&lt;"))
      .replace("{{titleJson}}", JSON.stringify(title))
      .replace("{{vidJson}}", JSON.stringify(movieId))
      .replace("{{init}}", init)
  );
});

module.exports = app;
