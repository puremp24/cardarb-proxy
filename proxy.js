const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 8080;
const fetch = global.fetch;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

let cachedToken = null;
let tokenExpiry = 0;

// ─────────────────────────────────────
// TOKEN
// ─────────────────────────────────────
async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope"
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error("Token failed");

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 120) * 1000;

  return cachedToken;
}

// ─────────────────────────────────────
// BASIC CLEANING
// ─────────────────────────────────────
function cleanTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .slice(0, 6)
    .join(" ");
}

// ─────────────────────────────────────
// GET COMPS FOR A CARD 🔥
// ─────────────────────────────────────
async function getComps(token, title) {
  const query = cleanTitle(title);

  const res = await fetch(
    "https://api.ebay.com/buy/browse/v1/item_summary/search?q=" + encodeURIComponent(query) + "&limit=10",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
      }
    }
  );

  const json = await res.json();

  const prices = (json.itemSummaries || [])
    .map(i => parseFloat(i.price?.value || 0))
    .filter(p => p > 5)
    .sort((a,b)=>a-b);

  if (prices.length === 0) return null;

  return prices[Math.floor(prices.length / 2)];
}

// ─────────────────────────────────────
// MAIN SEARCH
// ─────────────────────────────────────
async function browse(q) {
  const token = await getToken();

  const res = await fetch(
    "https://api.ebay.com/buy/browse/v1/item_summary/search?q=" + encodeURIComponent(q) + "&limit=25",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
      }
    }
  );

  const json = await res.json();

  const items = json.itemSummaries || [];

  const results = [];

  for (const item of items) {
    const price = parseFloat(item.price?.value || 0);
    if (price < 10) continue;

    const market = await getComps(token, item.title);
    if (!market) continue;

    const maxBuy = market * 0.8;

    if (price <= maxBuy) {
      results.push({
        title: item.title,
        price,
        marketPrice: market,
        url: item.itemWebUrl,
        bestOffer: item.buyingOptions?.includes("BEST_OFFER") || false,
        offer: {
          startOffer: +(maxBuy * 0.8).toFixed(2),
          maxOffer: +maxBuy.toFixed(2),
          profit: +(market - price).toFixed(2)
        }
      });
    }
  }

  return results;
}

// ─────────────────────────────────────
// ROUTES
// ─────────────────────────────────────
app.get("/scan", async (req, res) => {
  try {
    const query = req.query.binQ || "bowman chrome auto";

    const deals = await browse(query);

    res.json({
      count: deals.length,
      deals
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/ping", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log("REAL ENGINE RUNNING");
});
