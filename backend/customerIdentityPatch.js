// CRM Telegram profile-photo sync. Runs inside the existing Express/Supabase scope.
async function syncTelegramProfilePhotos(user) {
  const { data: currentRow } = await supabase
    .from("telegram_users")
    .select("profile_photos")
    .eq("telegram_id", user.id)
    .maybeSingle();

  const existing = Array.isArray(currentRow?.profile_photos) ? currentRow.profile_photos : [];
  const merged = [];
  const seen = new Set();
  const add = (photo) => {
    const key = photo?.file_unique_id || photo?.url || photo?.path;
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(photo);
  };

  // Always persist the current WebApp photo first. This must not depend on
  // Storage or Bot API availability, otherwise CRM would still show 0 photos.
  if (user.photo_url) {
    add({
      file_unique_id: `webapp-${crypto.createHash("sha256").update(user.photo_url).digest("hex").slice(0, 32)}`,
      url: user.photo_url,
      source: "telegram_webapp",
      current: true,
      saved_at: new Date().toISOString()
    });
  }
  existing.forEach(add);

  // Best-effort history import. If Storage/Bot API is unavailable, the current
  // WebApp URL remains saved and the sync endpoint still succeeds.
  let telegramApiWorked = false;
  try {
    let offset = 0;
    for (let page = 0; page < 10; page++) {
      const result = await telegramApi("getUserProfilePhotos", { user_id: user.id, offset, limit: 100 });
      telegramApiWorked = true;
      const photos = Array.isArray(result?.photos) ? result.photos : [];
      if (!photos.length) break;
      let bucketReady = false;
      try {
        const bucket = "telegram-profile-photos";
        const bucketResult = await supabase.storage.getBucket(bucket);
        if (bucketResult.error) {
          const created = await supabase.storage.createBucket(bucket, { public: false });
          if (created.error && !/already exists|duplicate/i.test(created.error.message || "")) throw created.error;
        }
        bucketReady = true;
      } catch (storageError) {
        console.warn("Telegram profile photo storage unavailable:", storageError.message);
      }

      for (const sizes of photos) {
        const largest = Array.isArray(sizes) && sizes.length ? sizes[sizes.length - 1] : null;
        if (!largest?.file_id || !largest?.file_unique_id) continue;
        if (existing.some(p => p?.file_unique_id === largest.file_unique_id)) {
          add(existing.find(p => p.file_unique_id === largest.file_unique_id));
          continue;
        }
        if (!bucketReady) continue;
        try {
          const file = await telegramApi("getFile", { file_id: largest.file_id });
          if (!file?.file_path) continue;
          const response = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`);
          if (!response.ok) continue;
          const buffer = Buffer.from(await response.arrayBuffer());
          const ext = /\.png$/i.test(file.file_path) ? "png" : /\.webp$/i.test(file.file_path) ? "webp" : "jpg";
          const path = `users/${user.id}/${largest.file_unique_id}.${ext}`;
          const upload = await supabase.storage.from("telegram-profile-photos").upload(path, buffer, {
            contentType: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
            cacheControl: "31536000",
            upsert: true
          });
          if (upload.error) continue;
          add({ file_unique_id: largest.file_unique_id, path, width: largest.width || 0, height: largest.height || 0, source: "telegram_bot_api" });
        } catch (photoError) {
          console.warn("Telegram profile photo import skipped:", photoError.message);
        }
      }
      offset += photos.length;
      if (offset >= Number(result.total_count || 0)) break;
    }
  } catch (error) {
    console.warn("Telegram profile photo history unavailable:", error.message);
  }

  const currentUrl = user.photo_url || "";
  const ordered = merged.map(p => ({ ...p, current: currentUrl ? p.url === currentUrl : Boolean(p.current) }));
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
    res.status(500).json({ success: false, message: "Telegram profil rasmini saqlashda xatolik", detail: error.message });
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
    const photos = [];
    for (const photo of (Array.isArray(user?.profile_photos) ? user.profile_photos : [])) {
      if (photo?.url && !photo.path) { photos.push(photo); continue; }
      if (!photo?.path) continue;
      const signed = await supabase.storage.from("telegram-profile-photos").createSignedUrl(photo.path, 3600);
      if (!signed.error && signed.data?.signedUrl) photos.push({ ...photo, url: signed.data.signedUrl });
    }
    res.json({ success: true, data: { user: user || { telegram_id: telegramId }, photos, currentPhoto: photos.find(p => p.current)?.url || photos[0]?.url || null, addresses: addresses || [], orders: orders || [] } });
  } catch (error) {
    console.error("Admin customer details error:", error);
    res.status(500).json({ success: false, message: "Mijoz profilini yuklashda xatolik", detail: error.message });
  }
});
