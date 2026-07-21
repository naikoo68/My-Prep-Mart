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
  const allowed = [
    "siteName", "tagline", "logoUrl", "primaryColor", "accentColor",
    "fontFamily", "socialLinks", "contacts",
    "navHeight", "navBrandSize", "navFontSize", "navFontWeight", "navFontFamily", "navTextTransform", "defaultZoom",
    "watermarkEnabled", "watermarkText", "watermarkOpacity", "watermarkSize", "watermarkMode", "restrictCopy", "screenshotGuard", "guardHoldMs", "statsAuto", "notifyOnNewContent",
    "homeSections",
    "aboutHeading", "aboutIntro", "aboutValues", "aboutStats",
    "aiMaxPerBatch", "aiPlans",
  ];
  const update = {};
  for (const k of allowed) if (k in req.body) update[k] = req.body[k];

  // AI limits: clamp the global per-batch ceiling and sanitize the plan list.
  if ("aiMaxPerBatch" in update) {
    update.aiMaxPerBatch = Math.max(1, Math.min(5000, parseInt(update.aiMaxPerBatch, 10) || 50));
  }
  if (Array.isArray(update.aiPlans)) {
    update.aiPlans = update.aiPlans
      .map((p) => ({
        name: String(p?.name || "").trim(),
        maxPerBatch: Math.max(1, Math.min(5000, parseInt(p?.maxPerBatch, 10) || 1)),
        perWindow: Math.max(1, Math.min(100000, parseInt(p?.perWindow, 10) || 1)),
        windowMinutes: Math.max(1, Math.min(1440, parseInt(p?.windowMinutes, 10) || 5)),
      }))
      .filter((p) => p.name);
  }

  // Make social links absolute so a link pasted without http:// still works.
  if (Array.isArray(update.socialLinks)) {
    update.socialLinks = update.socialLinks
      .filter((s) => s && s.url && s.url.trim() && s.url.trim() !== "#")
      .map((s) => {
        const u = s.url.trim();
        return { platform: s.platform, url: /^https?:\/\//i.test(u) ? u : `https://${u}` };
      });
  }

  const s = await Settings.findOneAndUpdate({ key: "site" }, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
  res.json(s);
}
