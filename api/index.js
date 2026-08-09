const express = require("express");
const { makeToken, resolveToken } = require("../lib/tokens");
const { extractFromPage } = require("../lib/extractor");

const CODE = process.env.FHD_CODE || "";
const API = process.env.FHD_API || "https://fashd.com/faselhd15/public/api/";
const SITE = process.env.FHD_SITE || "https://web8818x.faselhdx.life";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Accept-Language": "ar,en;q=0.9" };
const CDN_HEADERS = { ...HEADERS, Referer: SITE + "/", Origin: SITE };

const app = express();
const cache = new Map();
const rl = new Map();
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
    st.textContent = 'لقيت ' + data.results.length + ' نتيجة';
    render(data.results);
  } catch (e) { st.textContent = 'خطأ في البحث'; }
  btn.disabled = false;
}

function render(movies) {
  res.innerHTML = '';
  for (const m of movies) {
    const poster = m.poster_path ? 'https://image.tmdb.org/t/p/w300' + m.poster_path : '';
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
:root { --bg:#0b0d12; --card:#141823; --border:#232a3a; --text:#e8ecf4; --dim:#8b93a7; --accent:#ff434c; }
* { box-sizing:border-box; margin:0; padding:0; }
body { background:var(--bg); color:var(--text); font-family:'Segoe UI',Tahoma,sans-serif; }
.top { display:flex; align-items:center; gap:14px; padding:16px 22px; border-bottom:1px solid var(--border); }
.top a { color:var(--accent); text-decoration:none; font-size:15px; font-weight:bold; }
.top h1 { font-size:18px; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.wrap { max-width:1100px; margin:20px auto; padding:0 16px; }
.player-box { border-radius:14px; overflow:hidden; border:1px solid var(--border); background:#000; }
video { width:100%; aspect-ratio:16/9; display:block; background:#000; outline:none; }
.quals { display:flex; gap:10px; margin-top:16px; flex-wrap:wrap; }
.qual { padding:10px 22px; border-radius:10px; border:1px solid var(--border); background:var(--card); color:var(--text); cursor:pointer; font-size:14px; font-weight:bold; }
.qual.active { background:var(--accent); border-color:var(--accent); color:#fff; }
.links { margin-top:18px; }
.links summary { cursor:pointer; color:var(--dim); font-size:13px; margin-bottom:8px; }
.links code { display:block; background:var(--card); border:1px solid var(--border); border-radius:8px; padding:10px 12px; margin:6px 0; font-size:11px; direction:ltr; text-align:left; word-break:break-all; color:var(--dim); }
#err { display:none; text-align:center; color:var(--accent); padding:40px 0; font-size:16px; }
</style>
</head>
<body>
<div class="top">
  <a href="/">← بحث جديد</a>
  <h1>{{title}}</h1>
</div>
<div class="wrap">
  <div id="err">مفيش روابط شغالة</div>
  <div class="player-box"><video id="player" controls></video></div>
  <div class="quals" id="quals"></div>
  <details class="links"><summary>عرض كل الروابط</summary><div id="alllinks"></div></details>
</div>

<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js"></script>
<script>
const links = {{links}};
let hls = null;
const video = document.getElementById('player');
const err = document.getElementById('err');
const all = document.getElementById('alllinks');

for (const l of links) {
  const c = document.createElement('code');
  c.textContent = l.url;
  all.appendChild(c);
}

function load(src) {
  if (hls) { hls.destroy(); hls = null; }
  if (Hls.isSupported()) {
    hls = new Hls({ enableWorker: true, maxBufferLength: 30 });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (evt, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        }
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src;
  } else {
    err.style.display = 'block';
    err.textContent = 'المتصفح لا يدعم HLS';
  }
  video.play().catch(() => {});
}

const qs = document.getElementById('quals');
for (const l of links) {
  const b = document.createElement('button');
  b.className = 'qual';
  b.dataset.q = l.tag;
  b.textContent = l.label;
  b.addEventListener('click', () => {
    document.querySelectorAll('.qual').forEach(q => q.classList.toggle('active', q.dataset.q === l.tag));
    load(l.url);
  });
  qs.appendChild(b);
}

const first = links.find(x => x.tag === 'master') || links[0];
document.querySelectorAll('.qual').forEach(q => q.classList.toggle('active', q.dataset.q === first.tag));
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
  const url = API + "search/" + encodeURIComponent(q) + "/" + CODE;
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error("api " + r.status);
  const data = await r.json();
  return (data.search || []).filter((m) => String(m.type || "").toLowerCase() === "movie");
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

async function verifyM3u8(url) {
  try {
    const r = await fetch(url, { headers: CDN_HEADERS, signal: AbortSignal.timeout(15000) });
    const buf = Buffer.from(await r.arrayBuffer());
    return r.ok && buf.subarray(0, 7).toString() === "#EXTM3U";
  } catch {
    return false;
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
    const results = await apiSearch(q);
    res.json({ results });
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
    return res.json({ links: cached.links });
  }

  try {
    const siteLinks = await siteSearch(title);
    const pageUrl = siteLinks[0] || SITE + "/?p=" + movieId;
    const m3u8s = await extractFromPage(pageUrl);
    const links = [];
    for (const l of buildLinks(m3u8s)) {
      const tok = l.url.split("/").pop();
      if (await verifyM3u8(resolveToken(tok))) links.push(l);
    }
    cache.set(movieId, { ts: Date.now(), links });
    res.json({ links, page: pageUrl });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

app.get("/s/:token", async (req, res) => {
  const url = resolveToken(req.params.token);
  if (!url) return res.status(404).end();
  let r;
  try {
    r = await fetch(url, { headers: CDN_HEADERS, signal: AbortSignal.timeout(30000) });
  } catch {
    return res.status(502).end();
  }
  if (!r.ok) return res.status(r.status).end();
  const body = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get("content-type") || "";

  const isPlaylist = body.subarray(0, 7).toString() === "#EXTM3U" || url.includes("m3u8") || ct.includes("mpegurl") || ct.includes("playlist");
  if (isPlaylist) {
    const text = body.toString("utf8");
    const lines = text.split(/\r?\n/).map((line) => {
      if (line.startsWith("#") || !line.trim()) return line;
      const seg = new URL(line.trim(), url).toString();
      return "/s/" + makeToken(seg);
    });
    res.set("Content-Type", "application/vnd.apple.mpegurl");
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "no-cache");
    return res.send(lines.join("\n"));
  }

  res.set("Content-Type", url.includes(".ts") ? "video/mp2t" : ct || "application/octet-stream");
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Cache-Control", "no-cache");
  res.send(body);
});

app.get("/watch", (req, res) => {
  const title = String(req.query.title || "فيلم");
  const movieId = String(req.query.id || "");
  const cached = cache.get(movieId);
  const links = cached ? cached.links : [];
  if (!links.length) return res.status(404).send("لا توجد روابط");
  res.set("Content-Type", "text/html; charset=utf-8").send(
    WATCH_HTML.replace("{{title}}", title.replace(/</g, "&lt;")).replace("{{links}}", JSON.stringify(links))
  );
});

module.exports = app;
