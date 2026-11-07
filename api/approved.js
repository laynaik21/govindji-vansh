// GET /api/approved — the approved additions the website merges into the tree.
// Only names are returned; who sent them stays private.
import { cors, allSuggestions } from "./_lib.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });
  const items = (await allSuggestions())
    .filter(s => s.status === "approved" && (s.type === "child" || s.type === "spouse"))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(s => {
      const f = { ...s, ...(s.final || {}) };
      return s.type === "child"
        ? { id: s.id, type: "child", personId: f.personId, name: f.name, g: f.g, gu: f.gu || undefined, spouse: f.spouse || undefined }
        : { id: s.id, type: "spouse", personId: f.personId, spouse: f.spouse };
    });
  res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=120");
  return res.status(200).json({ items });
}
