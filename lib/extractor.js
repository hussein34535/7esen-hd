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

module.exports = { extractFromPage, extractM3u8, fetchPlayerHtml, resolvePlayerM3u8 };
