const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 8080;

// ✅ Use built-in fetch (Node 18+)
const fetch = global.fetch;

// ENV VARS
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

let cachedToken = null;
let tokenExpiry = 0;

// ── GET TOKEN ─────────────────────────
async function getToken() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error("Missing environment variables");
  }

  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("TOKEN ERROR:", data);
    throw new Error("Token failed");
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 120) * 1000;

  return cachedToken;
}

// ── SEARCH ─────────────────────────
async function browse(q) {
  const token = await getToken();

  const res = await fetch(
    "https://api.ebay.com/buy/browse/v1/item_summary/search?q=" + encodeURIComponent(q),
    {
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
      }
    }
  );

  const json = await res.json();

  return (json.itemSummaries || []).map(i => ({
    itemId: i.itemId,
    title: i.title,
    price: parseFloat(i.price?.value || 0),
    url: i.itemWebUrl,
    image: i.image?.imageUrl || null,
    bestOffer: i.buyingOptions?.includes("BEST_OFFER") || false
  }));
}

// ── ROUTES ─────────────────────────
app.get("/ping", (req, res) => {
  res.json({ ok: true });
});

app.get("/scan", async (req, res) => {
  try {
    const listings = await browse(req.query.binQ);

    res.json({
      listings,
      marketPrice: listings.length ? listings[0].price : null
    });
  } catch (e) {
    console.error("SCAN ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── START SERVER ─────────────────────────
app.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT", PORT);
});
