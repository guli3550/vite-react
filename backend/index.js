const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL =
  process.env.RENDER_EXTERNAL_URL || "https://guli-lingerie-api.onrender.com";

async function telegramApi(method, body) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.description || "Telegram API xatosi");
  }

  return result.result;
}

async function setupTelegramWebhook() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN topilmadi; webhook o'rnatilmadi.");
    return;
  }

  try {
    const webhookUrl = `${BASE_URL}/api/telegram/webhook`;
    await telegramApi("setWebhook", { url: webhookUrl });
    console.log(`Telegram webhook set: ${webhookUrl}`);
  } catch (error) {
    console.error("Telegram webhook o'rnatilmadi:", error.message);
  }
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "GULI LINGERIE API ishlayapti 🌷",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "online",
  });
});

// Telegram Mini App requestContact() yuborgan kontakt shu endpointga keladi.
app.post("/api/telegram/webhook", async (req, res) => {
  try {
    const message = req.body?.message;
    const contact = message?.contact;

    if (contact?.user_id && contact?.phone_number) {
      const telegramUser = message.from || {};

      const { error } = await supabase.from("telegram_users").upsert(
        {
          telegram_id: contact.user_id,
          username: telegramUser.username || null,
          first_name: telegramUser.first_name || null,
          last_name: telegramUser.last_name || null,
          telegram_phone: contact.phone_number,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "telegram_id" }
      );

      if (error) {
        console.error("Telegram kontaktini saqlash xatosi:", error);
      } else {
        console.log(
          `Telegram phone saved for user ${contact.user_id}`
        );
      }
    }

    // Telegram webhook tezda 200 javob olishi kerak.
    res.sendStatus(200);
  } catch (error) {
    console.error("Telegram webhook xatosi:", error);
    res.sendStatus(200);
  }
});

app.post("/api/save-address", async (req, res) => {
  try {
    const {
      telegram_id,
      username,
      phone,
      latitude,
      longitude,
      region,
      district,
      street,
      house,
      apartment,
      landmark,
    } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({
        success: false,
        message: "Lokatsiya koordinatalari topilmadi",
      });
    }

    const { data, error } = await supabase
      .from("saved_addresses")
      .insert([
        {
          telegram_id,
          username,
          phone,
          latitude,
          longitude,
          region,
          district,
          street,
          house,
          apartment,
          landmark,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Manzilni saqlashda xatolik",
        error: error.message,
      });
    }

    res.json({
      success: true,
      message: "Manzil muvaffaqiyatli saqlandi",
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server xatosi",
    });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const {
      order_number,
      telegram_id,
      username,
      first_name,
      phone,
      items,
      subtotal,
      delivery,
      discount,
      total,
      address,
      payment,
      status,
      created_at,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Buyurtma mahsulotlari topilmadi",
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        message: "Telefon raqami kiritilmagan",
      });
    }

    // Telegram kontaktidan oldindan tasdiqlangan raqamni olamiz.
    let telegram_phone = null;

    if (telegram_id != null) {
      const { data: telegramUser, error: telegramUserError } =
        await supabase
          .from("telegram_users")
          .select("telegram_phone")
          .eq("telegram_id", telegram_id)
          .maybeSingle();

      if (telegramUserError) {
        console.error("Telegram user lookup error:", telegramUserError);
      } else {
        telegram_phone = telegramUser?.telegram_phone || null;
      }
    }

    const order = {
      order_number: order_number || null,
      telegram_id: telegram_id || null,
      username: username || null,
      first_name: first_name || null,
      telegram_phone,
      phone: phone.trim(),
      items,
      subtotal: Number(subtotal) || 0,
      delivery: Number(delivery) || 0,
      discount: Number(discount) || 0,
      total: Number(total) || 0,
      address: address || null,
      payment: payment || "cash",
      status: status || "Qabul qilindi",
      created_at: created_at || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("orders")
      .insert([order])
      .select()
      .single();

    if (error) {
      console.error(error);

      if (error.code === "23505") {
        const existing = await supabase
          .from("orders")
          .select("*")
          .eq("order_number", order_number)
          .maybeSingle();

        if (existing.data) {
          const identityPatch = {};

          if (telegram_id != null && existing.data.telegram_id == null) {
            identityPatch.telegram_id = telegram_id;
          }
          if (username && existing.data.username == null) {
            identityPatch.username = username;
          }
          if (first_name && existing.data.first_name == null) {
            identityPatch.first_name = first_name;
          }
          if (telegram_phone && existing.data.telegram_phone == null) {
            identityPatch.telegram_phone = telegram_phone;
          }

          let updated = existing.data;

          if (Object.keys(identityPatch).length > 0) {
            const result = await supabase
              .from("orders")
              .update(identityPatch)
              .eq("id", existing.data.id)
              .select()
              .single();

            if (result.error) {
              console.error(result.error);
              return res.status(500).json({
                success: false,
                message: "Telegram ma'lumotlarini yangilashda xatolik",
                error: result.error.message,
              });
            }

            updated = result.data;
          }

          return res.status(200).json({
            success: true,
            message: "Buyurtma allaqachon saqlangan",
            data: updated,
            duplicate: true,
          });
        }
      }

      return res.status(500).json({
        success: false,
        message: "Buyurtmani saqlashda xatolik",
        error: error.message,
      });
    }

    res.status(201).json({
      success: true,
      message: "Buyurtma muvaffaqiyatli saqlandi",
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server xatosi",
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`GULI API running on port ${PORT}`);
  setupTelegramWebhook();
});
