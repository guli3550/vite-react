// This module is injected into backend/index.js by customerServer.js.
// It intentionally runs inside the original Express module scope so it can use
// app, supabase, telegramApi and the existing auth middleware without exposing secrets.

async function ensureProfilePhotoBucket() {
  const bucket = "telegram-profile-photos";
  const existing = await supabase.storage.getBucket(bucket);
  if (existing.error) {
    const created = await supabase.storage.createBucket(bucket, {
      public: false,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      fileSizeLimit: "2MB"
    });
    if (created.error && !/already exists|duplicate/i.test(created.error.message || "")) throw created.error;
  }
  return bucket;
}

async function syncTelegramProfilePhotos(user) {
  const bucket = await ensureProfilePhotoBucket();
  const { data: current } = await supabase
    .from("telegram_users")
    .select("profile_photos")
    .eq("telegram_id", user.id)
    .maybeSingle();

  const existing = Array.isArray(current?.profile_photos) ? current.profile_photos : [];
  const existingByUniqueId = new Map(existing.filter(p => p?.file_unique_id && p?.path).map(p => [p.file_unique_id, p]));
  const existingByUrl = new Set(existing.filter(p => p?.url).map(p => p.url));
  const all = [];
  let telegramApiWorked = false;
  let offset = 0;

  // Telegram Mini Apps now expose a validated photo_url on WebAppUser. Keep it
  // immediately, even when the Bot API cannot enumerate the user's old photos.
  // Every different URL seen on a future Mini App open is retained as history.
  if (user.photo_url && !existingByUrl.has(user.photo_url)) {
    all.push({
      file_unique_id: `webapp-${crypto.createHash("sha256").update(user.photo_url).digest("hex").slice(0, 24)}`,
      url: user.photo_url,
      source: "telegram_webapp",
      current: true,
      saved_at: new Date().toISOString()
    });
  }

  for (let page = 0; page < 20; page++) {
    try {
      const result = await telegramApi("getUserProfilePhotos", { user_id: user.id, offset, limit: 100 });
      telegramApiWorked = true;
      const photos = Array.isArray(result?.photos) ? result.photos : [];
      if (!photos.length) break;
      for (const sizes of photos) {
        const largest = Array.isArray(sizes) && sizes.length ? sizes[sizes.length - 1] : null;
        if (!largest?.file_id || !largest?.file_unique_id) continue;
        let stored = existingByUniqueId.get(largest.file_unique_id);
        if (!stored) {
          const file = await telegramApi("getFile", { file_id: largest.file_id });
          if (!file?.file_path) continue;
          const response = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`);
          if (!response.ok) continue;
          const buffer = Buffer.from(await response.arrayBuffer());
          const ext = /\.png$/i.test(file.file_path) ? "png" : /\.webp$/i.test(file.file_path) ? "webp" : "jpg";
          const path = `users/${user.id}/${largest.file_unique_id}.${ext}`;
          const upload = await supabase.storage.from(bucket).upload(path, buffer, {
            contentType: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
            cacheControl: "31536000",
            upsert: true
          });
          if (upload.error) throw upload.error;
          stored = { file_unique_id: largest.file_unique_id, path, width: largest.width || 0, height: largest.height || 0, source: "telegram_bot_api" };
        }
        all.push({ ...stored, file_id: largest.file_id, width: largest.width || stored.width || 0, height: largest.height || stored.height || 0 });
      }
      offset += photos.length;
      if (offset >= Number(result.total_count || 0)) break;
    } catch (error) {
      // Do not lose the current WebApp photo just because getUserProfilePhotos
      // is unavailable for this user/bot relationship.
      console.warn("Telegram profile photo history unavailable:", error.message);
      break;
    }
  }

  const merged = [];
  const seen = new Set();
  for (const photo of [...all, ...existing]) {
    const key = photo?.file_unique_id || photo?.url || photo?.path;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(photo);
  }

  // If Telegram returned a current WebApp photo, keep it first so the admin
  // profile avatar always represents the latest photo seen in the Mini App.
  const currentUrl = user.photo_url || "";
  const ordered = currentUrl
    ? [
        ...merged.filter(p => p?.url === currentUrl).map(p => ({ ...p, current: true })),
        ...merged.filter(p => p?.url !== currentUrl).map(p => ({ ...p, current: false }))
      ]
    : merged;

  const { error } = await supabase.from("telegram_users").upsert({
    telegram_id: user.id,
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    profile_photos: ordered,
    profile_photo_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, { onConflict: "telegram_id" });
  if (error) throw error;
  return { photos: ordered, telegramApiWorked };
}

app.post("/api/profile/sync", requireTelegramUser, async (req, res) => {
  try {
    const result = await syncTelegramProfilePhotos(req.telegramUser);
    res.json({ success: true, data: { photoCount: result.photos.length, currentPhoto: req.telegramUser.photo_url || null, historySource: result.telegramApiWorked ? "telegram+webapp" : "webapp-snapshots" } });
  } catch (error) {
    console.error("Telegram profile sync error:", error);
    // Profile sync must never block the Mini App itself.
    res.status(200).json({ success: true, data: { photoCount: 0, synced: false } });
  }
});

app.get("/api/admin/users/:telegramId/details", requireAdmin, async (req, res) => {
  try {
    const telegramId = Number(req.params.telegramId);
    if (!Number.isFinite(telegramId)) return res.status(400).json({ success: false, message: "Telegram ID noto‘g‘ri" });
    const [{ data: user, error: userError }, { data: addresses, error: addressError }, { data: orders, error: orderError }] = await Promise.all([
      supabase.from("telegram_users").select("telegram_id,username,first_name,last_name,telegram_phone,profile_photos,profile_photo_synced_at,updated_at").eq("telegram_id", telegramId).maybeSingle(),
      supabase.from("saved_addresses").select("*").eq("telegram_id", telegramId).order("created_at", { ascending: false }),
      supabase.from("orders").select("*").eq("telegram_id", telegramId).order("created_at", { ascending: false }).limit(500)
    ]);
    if (userError) throw userError;
    if (addressError) throw addressError;
    if (orderError) throw orderError;
    const bucket = "telegram-profile-photos";
    const rawPhotos = Array.isArray(user?.profile_photos) ? user.profile_photos : [];
    const photos = [];
    for (const photo of rawPhotos) {
      if (photo?.url && !photo.path) {
        photos.push({ ...photo, url: photo.url });
        continue;
      }
      if (!photo?.path) continue;
      const signed = await supabase.storage.from(bucket).createSignedUrl(photo.path, 60 * 60);
      if (!signed.error && signed.data?.signedUrl) photos.push({ ...photo, url: signed.data.signedUrl });
    }
    res.json({ success: true, data: {
      user: user || { telegram_id: telegramId },
      photos,
      currentPhoto: photos.find(p => p.current)?.url || photos[0]?.url || null,
      addresses: addresses || [],
      orders: orders || []
    }});
  } catch (error) {
    console.error("Admin customer details error:", error);
    res.status(500).json({ success: false, message: "Mijoz profilini yuklashda xatolik", detail: error.message });
  }
});
