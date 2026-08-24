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

    if (!latitude || !longitude) {
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

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`GULI API running on port ${PORT}`);
});
