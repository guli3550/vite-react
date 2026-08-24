const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "GULI LINGERIE API ishlayapti 🚀",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "online",
  });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`GULI API running on port ${PORT}`);
});
