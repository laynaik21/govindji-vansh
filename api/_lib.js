// Shared helpers for the suggestion inbox. Files starting with "_" are not
// deployed as their own endpoints.
import { put, list, get } from "@vercel/blob";
import { timingSafeEqual } from "node:crypto";

// Pages allowed to talk to this API from a browser.
const ALLOWED_ORIGINS = ["https://laynaik21.github.io"];

export function cors(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin) || /^https:\/\/govindji-vansh[a-z0-9-]*\.vercel\.app$/.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
}

export const clean = (v, max = 80) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const save = (path, obj) =>
  put(path, JSON.stringify(obj), { access: "private", contentType: "application/json", addRandomSuffix: false });

async function readJSON(pathname) {
  const r = await get(pathname, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return null;
  try { return await new Response(r.stream).json(); } catch { return null; }
}

async function listAll(prefix) {
  const out = []; let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

export const saveSuggestion = s => save(`suggestions/${s.id}.json`, s);
export const saveDecision = d => save(`decisions/${d.id}/${Date.now()}.json`, d);

// Every suggestion with its latest decision applied (pending if none).
export async function allSuggestions() {
  const [sBlobs, dBlobs] = await Promise.all([listAll("suggestions/"), listAll("decisions/")]);
  const latest = new Map();
  for (const b of dBlobs) {
    const [, id, ts] = b.pathname.split("/");
    const t = parseInt(ts, 10);
    if (!latest.has(id) || latest.get(id).t < t) latest.set(id, { t, pathname: b.pathname });
  }
  const [suggestions, decisions] = await Promise.all([
    Promise.all(sBlobs.map(b => readJSON(b.pathname))),
    Promise.all([...latest.values()].map(d => readJSON(d.pathname)))
  ]);
  const byId = new Map(decisions.filter(Boolean).map(d => [d.id, d]));
  return suggestions.filter(Boolean).map(s => {
    const d = byId.get(s.id);
    return d ? { ...s, status: d.status, decidedAt: d.at, final: d.final || null } : { ...s, status: "pending" };
  }).sort((a, b) => b.createdAt - a.createdAt);
}

export function isAdmin(req) {
  const want = process.env.ADMIN_KEY || "";
  const got = String(req.headers["x-admin-key"] || "");
  if (want.length < 6) return { ok: false, reason: "not-configured" };
  const a = Buffer.from(want), b = Buffer.from(got);
  return { ok: a.length === b.length && timingSafeEqual(a, b), reason: "wrong-key" };
}
