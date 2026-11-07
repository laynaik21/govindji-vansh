// /api/admin — Lay's private approval actions. Needs the ADMIN_KEY passcode.
//   GET  → every suggestion with its status
//   POST { id, status: "approved" | "rejected" | "pending", final? } → record a decision
import { cors, clean, isAdmin, allSuggestions, saveDecision } from "./_lib.js";

const STATUSES = new Set(["approved", "rejected", "pending"]);

export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  const auth = isAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: auth.reason });

  if (req.method === "GET") return res.status(200).json({ items: await allSuggestions() });

  if (req.method === "POST") {
    const b = typeof req.body === "object" && req.body ? req.body : {};
    const id = clean(b.id, 40);
    if (!id || !STATUSES.has(b.status)) return res.status(400).json({ error: "Bad request" });
    const all = await allSuggestions();
    if (!all.some(s => s.id === id)) return res.status(404).json({ error: "Not found" });
    // Lay can fix spelling before approving
    const f = b.final && typeof b.final === "object" ? {
      name: clean(b.final.name, 60), g: b.final.g === "f" || b.final.g === "m" ? b.final.g : "",
      gu: clean(b.final.gu, 60), spouse: clean(b.final.spouse, 60), personId: clean(b.final.personId, 60)
    } : null;
    if (f) Object.keys(f).forEach(k => { if (!f[k]) delete f[k]; });
    await saveDecision({ id, status: b.status, at: Date.now(), final: f && Object.keys(f).length ? f : null });
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: "Method not allowed" });
}
