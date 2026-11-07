// POST /api/suggest — anyone visiting the family tree can send a suggestion.
// It is stored privately as "pending" and only reaches the site once approved.
import { cors, clean, newId, saveSuggestion } from "./_lib.js";

const TYPES = new Set(["child", "spouse", "other"]);

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const b = typeof req.body === "object" && req.body ? req.body : {};
  if (clean(b.website)) return res.status(200).json({ ok: true }); // hidden field: bots fill it, people don't

  const type = TYPES.has(b.type) ? b.type : "";
  const s = {
    id: newId(),
    createdAt: Date.now(),
    type,
    personId: clean(b.personId, 60),
    personName: clean(b.personName, 60),
    personPath: clean(b.personPath, 300),
    name: clean(b.name, 60),
    g: b.g === "f" || b.g === "m" ? b.g : "",
    gu: clean(b.gu, 60),
    spouse: clean(b.spouse, 60),
    note: clean(b.note, 600),
    from: clean(b.from, 60)
  };

  const problems = [];
  if (!type) problems.push("Choose what you're adding.");
  if (!s.personId) problems.push("Missing person.");
  if (!s.from) problems.push("Please add your name.");
  if (type === "child" && !s.name) problems.push("Please add the child's name.");
  if (type === "child" && !s.g) problems.push("Please choose son or daughter.");
  if (type === "spouse" && !s.spouse) problems.push("Please add the spouse's name.");
  if (type === "other" && !s.note) problems.push("Please write your correction or note.");
  if (problems.length) return res.status(400).json({ error: problems.join(" ") });

  await saveSuggestion(s);
  return res.status(201).json({ ok: true });
}
