// CRM Telegram profile-photo support.
// Telegram Bot API supplies the profile-photo list; the browser receives only
// short-lived signed proxy URLs, so the bot token is never exposed and an
// <img> request does not need an Authorization header.
function signPhotoAccess(telegramId, fileId, expires) {
  const payload = `${Number(telegramId)}.${String(fileId)}.${Number(expires)}`;
  return crypto.createHmac("sha256", ADMIN_SECRET).update(payload).digest("base64url");
}
function photoProxyUrl(telegramId, fileId) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const signature = signPhotoAccess(telegramId, fileId, expires);
  return `${BASE_URL}/api/admin/users/${encodeURIComponent(telegramId)}/photo/${encodeURIComponent(fileId)}?expires=${expires}&signature=${encodeURIComponent(signature)}`;
}
function verifyPhotoAccess(telegramId, fileId, expires, signature) {
  if (!ADMIN_SECRET || !signature || !Number.isFinite(Number(expires))) return false;
  if (Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const expected = signPhotoAccess(telegramId, fileId, expires);
  return safeEqual(signature, expected);
}

async function getTelegramProfilePhotoList(telegramId) {
  try {
    const result = await telegramApi("getUserProfilePhotos", { user_id: Number(telegramId), offset: 0, limit: 100 });
    const groups = Array.isArray(result?.photos) ? result.photos : [];
    const photos = [];
    for (let i = 0; i < groups.length; i++) {
      const sizes = Array.isArray(groups[i]) ? groups[i] : [];
      const largest = sizes.length ? sizes[sizes.length - 1] : null;
      if (!largest?.file_id) continue;
      photos.push({
        file_id: largest.file_id,
        file_unique_id: largest.file_unique_id || largest.file_id,
        width: largest.width || 0,
        height: largest.height || 0,
        current: i === 0,
        url: photoProxyUrl(telegramId, largest.file_id)
      });
    }
    return { total_count: Number(result?.total_count || photos.length), photos };
  } catch (error) {
    console.warn("Telegram profile photos unavailable:", error.message);
    return { total_count: 0, photos: [] };
  }
}

app.get("/api/admin/users/:telegramId/details", requireAdmin, async (req, res) => {
  try {
    const telegramId = Number(req.params.telegramId);
    if (!Number.isFinite(telegramId)) return res.status(400).json({ success: false, message: "Telegram ID noto‘g‘ri" });
    const [{ data: user, error: userError }, { data: addresses, error: addressError }, { data: orders, error: orderError }] = await Promise.all([
      supabase.from("telegram_users").select("telegram_id,username,first_name,last_name,telegram_phone,updated_at").eq("telegram_id", telegramId).maybeSingle(),
      supabase.from("saved_addresses").select("*").eq("telegram_id", telegramId).order("created_at", { ascending: false }),
      supabase.from("orders").select("*").eq("telegram_id", telegramId).order("created_at", { ascending: false }).limit(500)
    ]);
    if (userError) throw userError;
    if (addressError) throw addressError;
    if (orderError) throw orderError;
    const photoResult = await getTelegramProfilePhotoList(telegramId);
    res.json({ success: true, data: {
      user: user || { telegram_id: telegramId },
      photos: photoResult.photos,
      currentPhoto: photoResult.photos[0]?.url || null,
      photoCount: photoResult.total_count,
      addresses: addresses || [],
      orders: orders || []
    }});
  } catch (error) {
    console.error("Admin customer details error:", error);
    res.status(500).json({ success: false, message: "Mijoz profilini yuklashda xatolik", detail: error.message });
  }
});

app.get("/api/admin/order/:orderNumber/customer-photos", requireAdmin, async (req, res) => {
  try {
    const orderNumber = String(req.params.orderNumber || "").trim();
    if (!orderNumber) return res.status(400).json({ success: false, message: "Buyurtma raqami noto‘g‘ri" });
    const { data: order, error } = await supabase.from("orders").select("telegram_id,username,first_name").eq("order_number", orderNumber).maybeSingle();
    if (error) throw error;
    if (!order?.telegram_id) return res.json({ success: true, data: { telegram_id: null, photos: [] } });
    const photoResult = await getTelegramProfilePhotoList(order.telegram_id);
    res.json({ success: true, data: { telegram_id: order.telegram_id, username: order.username || null, first_name: order.first_name || null, photos: photoResult.photos, photoCount: photoResult.total_count } });
  } catch (error) {
    console.error("Admin order customer photos error:", error);
    res.status(500).json({ success: false, message: "Buyurtma mijoz rasmini yuklashda xatolik" });
  }
});

// Browser image elements cannot attach the admin Bearer header. This endpoint
// therefore accepts only the short-lived HMAC signature generated above.
app.get("/api/admin/users/:telegramId/photo/:fileId", async (req, res) => {
  try {
    const telegramId = Number(req.params.telegramId);
    const fileId = String(req.params.fileId || "");
    const expires = Number(req.query.expires);
    const signature = String(req.query.signature || "");
    if (!Number.isFinite(telegramId) || !fileId || !verifyPhotoAccess(telegramId, fileId, expires, signature)) return res.status(403).end();
    const file = await telegramApi("getFile", { file_id: fileId });
    if (!file?.file_path) return res.status(404).end();
    const response = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`);
    if (!response.ok) return res.status(502).end();
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());
    res.set("Content-Type", contentType);
    res.set("Content-Length", String(buffer.length));
    res.set("Cache-Control", "private, max-age=3600");
    res.send(buffer);
  } catch (error) {
    console.error("Telegram profile photo proxy error:", error);
    res.status(502).end();
  }
});

// Keep the Mini App sync endpoint as a lightweight health/snapshot operation.
// The actual CRM gallery reads directly from Telegram, so it never depends on
// a Supabase profile-photo column existing.
app.post("/api/profile/sync", requireTelegramUser, async (req, res) => {
  try {
    const photos = await getTelegramProfilePhotoList(req.telegramUser.id);
    res.json({ success: true, data: { photoCount: photos.total_count, currentPhoto: photos.photos[0]?.url || req.telegramUser.photo_url || null } });
  } catch (error) {
    res.json({ success: true, data: { photoCount: 0, currentPhoto: req.telegramUser.photo_url || null } });
  }
});
