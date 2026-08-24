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

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "GULI LINGERIE API ishlayapti 🌷"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "online"
  });
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
      landmark
    } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({
        success: false,
        message: "Lokatsiya koordinatalari topilmadi"
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
          landmark
        }
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Manzilni saqlashda xatolik",
        error: error.message
      });
    }

    res.json({
      success: true,
      message: "Manzil muvaffaqiyatli saqlandi",
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server xatosi"
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
      created_at
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Buyurtma mahsulotlari topilmadi"
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        message: "Telefon raqami kiritilmagan"
      });
    }

    const order = {
      order_number: order_number || null,
      telegram_id: telegram_id || null,
      username: username || null,
      first_name: first_name || null,
      phone: phone.trim(),
      items,
      subtotal: Number(subtotal) || 0,
      delivery: Number(delivery) || 0,
      discount: Number(discount) || 0,
      total: Number(total) || 0,
      address: address || null,
      payment: payment || "cash",
      status: status || "Qabul qilindi",
      created_at: created_at || new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("orders")
      .insert([order])
      .select()
      .single();

    if (error) {
      console.error(error);

      // A repeated order number should not create a duplicate order.
      // If the original row was created before Telegram identity was
      // available, backfill telegram_id / username / first_name now.
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
                error: result.error.message
              });
            }

            updated = result.data;
          }

          return res.status(200).json({
            success: true,
            message: "Buyurtma allaqachon saqlangan",
            data: updated,
            duplicate: true
          });
        }
      }

      return res.status(500).json({
        success: false,
        message: "Buyurtmani saqlashda xatolik",
        error: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: "Buyurtma muvaffaqiyatli saqlandi",
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server xatosi"
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`GULI API running on port ${PORT}`);
});
