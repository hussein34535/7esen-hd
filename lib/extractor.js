const { JSDOM } = require("jsdom");

const SITE = process.env.FHD_SITE || "https://web8818x.faselhdx.life";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

async function fetchPlayerHtml(pageUrl) {
  const r = await fetch(pageUrl, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error("film page " + r.status);
  const text = await r.text();
  const toks = text.match(/player_token=([A-Za-z0-9_\-\.]+)/g) || [];
  if (!toks.length) return null;
  const token = toks[0].split("=")[1];
  const vp = await fetch(SITE + "/video_player?player_token=" + token, {
    headers: { "User-Agent": UA, "Referer": pageUrl },
  });
  if (!vp.ok) throw new Error("player page " + vp.status);
  return vp.text();
}

function extractM3u8(html) {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const dom = new JSDOM("<!DOCTYPE html><html><body><div id='player'></div><div class='quality_change'></div></body></html>", {
    url: SITE + "/video_player",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window, document } = dom;

  global.window = window;
  global.self = window;
  global.document = document;
  global.navigator = window.navigator;
  global.location = { href: SITE + "/video_player", protocol: "https:", hostname: new URL(SITE).hostname, assign() {}, replace() {}, reload() {} };
  global.Cookies = { get: () => null, set: () => {} };
  global.jwplayer = () => ({ getPosition: () => 0, seek() {}, setup() {}, on() {}, play() {}, load() {}, getDuration: () => 0 });
  global.jwplayer.key = "";
  window.jwplayer = global.jwplayer;
  window.jwplayer.key = "";
  global.$ = window.jQuery = (sel) => {
    const q = document.querySelector(sel);
    return { ready: (fn) => fn(), on: () => {}, html: (v) => { if (q) q.innerHTML = v; }, append: () => {}, val: () => "", text: () => "" };
  };
  window.fetch = (url) => Promise.resolve({ ok: false, status: 404, url: String(url), json: async () => ({}), text: async () => "", arrayBuffer: async () => new ArrayBuffer(0), headers: new Map() });

  for (const code of scripts) {
    if (!code.trim() || code.length < 200) continue;
    if (!/_0x|data-url|jwplayer|\.m3u8/.test(code)) continue;
    try {
      window.eval(code);
    } catch {
      /* ignore */
    }
    global.document = window.document;
    global.location = { href: SITE + "/video_player", protocol: "https:", hostname: new URL(SITE).hostname, assign() {}, replace() {}, reload() {} };
  }

  const captured = window.document.body.innerHTML;
  let urls = [...new Set(captured.match(/data-url="([^"]+)"/g) || [])].map((u) => u.slice(10, -1));
  if (!urls.length) {
    urls = [...new Set(captured.match(/https?:\/\/[^"'\s<>]+/g) || [])].filter((u) => u.includes("m3u8"));
  }
  return urls.filter((u) => /scdns\.(io|com)/.test(u));
}

async function extractFromPage(pageUrl) {
  if (process.env.EXTRACT_DEBUG) console.log("[extract] fetch player html:", pageUrl);
  const html = await fetchPlayerHtml(pageUrl);
  if (process.env.EXTRACT_DEBUG) console.log("[extract] html len:", html && html.length);
  if (!html) return [];
  if (process.env.EXTRACT_DEBUG) console.log("[extract] running jsdom...");
  const urls = extractM3u8(html);
  if (process.env.EXTRACT_DEBUG) console.log("[extract] urls:", urls.length);
  return urls;
}

function resolvePlayerM3u8(html, pageUrl) {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const dom = new JSDOM("<!DOCTYPE html><html><body><div id='player'></div><video id='video'></video></body></html>", {
    url: pageUrl,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window, document } = dom;

  global.window = window;
  global.self = window;
  global.document = document;
  global.navigator = window.navigator;
  global.location = { href: pageUrl, protocol: "https:", hostname: new URL(pageUrl).hostname, assign() {}, replace() {}, reload() {} };
  global.Cookies = { get: () => null, set: () => {} };
  global.TextEncoder = window.TextEncoder = TextEncoder;
  global.TextDecoder = window.TextDecoder = TextDecoder;
  global.Uint8Array = window.Uint8Array = Uint8Array;
  try {
    window.crypto = window.crypto || {};
    if (!window.crypto.getRandomValues) window.crypto.getRandomValues = (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; };
    window.crypto.subtle = window.crypto.subtle || {
      digest: async () => new Uint8Array(32),
      encrypt: async () => new ArrayBuffer(0),
      decrypt: async () => new ArrayBuffer(0),
      importKey: async () => ({}),
      generateKey: async () => ({})
    };
  } catch { /* ignore */ }
  global.jwplayer = () => ({ getPosition: () => 0, seek() {}, setup(cfg) { window.__jwcfg = cfg; }, on() {}, play() {}, load() {}, getDuration: () => 0 });
  global.jwplayer.key = "";
  window.jwplayer = global.jwplayer;
  global.$ = window.jQuery = (sel) => {
    const q = document.querySelector(sel);
    return { ready: (fn) => fn(), on: () => {}, html: (v) => { if (q) q.innerHTML = v; }, append: () => {}, val: () => "", attr: () => "", text: () => "" };
  };
  window.fetch = (url) => Promise.resolve({ ok: false, status: 404, url: String(url), json: async () => ({}), text: async () => "", arrayBuffer: async () => new ArrayBuffer(0), headers: new Map() });

  for (const code of scripts) {
    if (!code.trim() || code.length < 100) continue;
    if (/ad[_-]?slot|advertiser|adsbygoogle|googletag|ad[_-]?block/.test(code)) continue;
    try { window.eval(code); } catch { /* ignore */ }
  }

  const body = window.document.body.innerHTML;
  const urls = [...new Set([...body.matchAll(/https?:\/\/[^"'\s<>]+m3u8[^"'\s<>]*/gi)].map((m) => m[0]))];
  const jwcfg = window.__jwcfg;
  if (!urls.length && jwcfg) {
    for (const s of [].concat(jwcfg.sources || [])) if (s && s.file) urls.push(s.file);
    for (const p of [].concat(jwcfg.playlist || [])) for (const s of [].concat(p.sources || [])) if (s && s.file) urls.push(s.file);
  }
  return urls;
}

async function fetchEgydeadPage(pageUrl) {
  const r = await fetch(pageUrl, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: new URL(pageUrl).origin,
      Referer: pageUrl,
    },
    body: "View=1",
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("egydead page " + r.status);
  return r.text();
}

function extractEgydeadServers(html) {
  const links = [];
  const re = /<li\s+data-link="([^"]+)"[^>]*>[\s\S]*?<p>([^<]*)<\/p>/g;
  let m;
  while ((m = re.exec(html))) links.push({ name: m[2].trim(), embed: m[1] });
  return links;
}

function unpackPacker(html) {
  const k = html.indexOf("eval(function(p,a,c,k,e,d)");
  if (k === -1) return null;
  let seg = html.slice(k, html.indexOf("</script>", k));
  if (seg === -1) return null;
  const open = seg.indexOf("}('");
  if (open === -1) return null;
  const data = readQuoted(seg, open + 3);
  if (!data) return null;
  const nums = seg.slice(data.end).match(/^,(\d+),(\d+),'/);
  if (!nums) return null;
  const a = parseInt(nums[1], 10), c = parseInt(nums[2], 10);
  const kEnd = seg.indexOf("'.split('|')", data.end);
  if (kEnd === -1) return null;
  const keys = seg.slice(data.end + nums[0].length, kEnd).split("|");
  const unesc = (s) =>
    s.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
     .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
     .replace(/\\(['"\\])/g, "$1");
  const kx = keys.map(unesc);
  const dat = unesc(data.val);
  let out = dat;
  for (let i = c - 1; i >= 0; i--) {
    if (!kx[i]) continue;
    out = out.split(new RegExp("\\b" + i.toString(a) + "\\b", "g")).join(kx[i]);
  }
  return out;
}

function readQuoted(str, from) {
  let out = "";
  for (let j = from; j < str.length; j++) {
    const ch = str[j];
    if (ch === "\\") { out += ch + (str[j + 1] || ""); j++; continue; }
    if (ch === "'") return { val: out, end: j + 1 };
    out += ch;
  }
  return null;
}

function extractStmrubyMaster(embedHtml) {
  const src = unpackPacker(embedHtml) || embedHtml;
  const m = src.match(/file:"(https:\/\/[^"]+\.urlset\/master\.(?:m3u8|txt)[^"]*)"/);
  const urls = m
    ? [m[1]]
    : [...src.matchAll(/https?:\/\/[^"'\s<>]+?\.urlset\/master\.(?:m3u8|txt)[^"'\s<>]*/gi)].map((x) => x[0]);
  return urls.find((u) => /\.m3u8/.test(u)) || urls[0] || null;
}

async function extractFromEgydead(pageUrl) {
  if (process.env.EXTRACT_DEBUG) console.log("[egydead] fetch page:", pageUrl);
  const html = await fetchEgydeadPage(pageUrl);
  const servers = extractEgydeadServers(html);
  if (process.env.EXTRACT_DEBUG) console.log("[egydead] servers:", servers.map((s) => s.name).join(","));
  const pref = servers.filter((s) => /streamruby|stmruby|earnvids|morencius/i.test(s.name));
  const order = [...pref, ...servers.filter((s) => !/streamruby|stmruby|earnvids|morencius/i.test(s.name))];
  for (const stm of order) {
    try {
      const ref = stm.embed.startsWith("//") ? "https:" + stm.embed : stm.embed;
      if (process.env.EXTRACT_DEBUG) console.log("[egydead] try embed:", ref, "refPageLen", pageUrl.length);
      const er = await fetch(ref, {
        headers: { "User-Agent": UA, Referer: pageUrl },
        signal: AbortSignal.timeout(20000),
      });
      if (process.env.EXTRACT_DEBUG) console.log("[egydead] embed status:", er.status);
      if (!er.ok) continue;
      const master = extractStmrubyMaster(await er.text());
      if (process.env.EXTRACT_DEBUG) console.log("[egydead] master:", master && master.slice(0, 110));
      if (!master) continue;
      return {
        master,
        headers: { Referer: new URL(ref).origin + "/", Origin: new URL(ref).origin, "User-Agent": UA, _embed: 1 },
        embed: ref,
      };
    } catch {
      /* جرّب السيرفر التالي */
    }
  }
  return null;
}

module.exports = { extractFromPage, extractM3u8, fetchPlayerHtml, resolvePlayerM3u8, extractFromEgydead, extractEgydeadServers, extractStmrubyMaster, unpackPacker };
