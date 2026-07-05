import Settings from "../models/Settings.js";

async function getOrCreate() {
  let s = await Settings.findOne({ key: "site" });
  if (!s) s = await Settings.create({ key: "site" });
  return s;
}

// GET /api/settings — public (frontend reads this to brand/theme itself)
export async function getSettings(req, res) {
  res.json(await getOrCreate());
}

// PUT /api/settings — admin only
export async function updateSettings(req, res) {
  const allowed = ["siteName", "tagline", "logoUrl", "primaryColor", "accentColor", "fontFamily"];
  const update = {};
  for (const k of allowed) if (k in req.body) update[k] = req.body[k];
  const s = await Settings.findOneAndUpdate({ key: "site" }, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
  res.json(s);
}
