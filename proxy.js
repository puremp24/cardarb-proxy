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
      "Authorization": `Basic ${creds}`,
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
// FILTER
// ─────────────────────────────────────
function isValid(title) {
  const t = title.toLowerCase();

  if (
    t.includes("lot") ||
    t.includes("pack") ||
    t.includes("box") ||
    t.includes("set") ||
    t.includes("you pick")
  ) return false;

  return true;
}

// ─────────────────────────────────────
// MARKET PRICE (median of comps)
// ─────────────────────────────────────
function getMarketPrice(listings) {
  const prices = listings.map(l => l.price).filter(p => p > 5).sort((a,b)=>a-b);

  if (prices.length === 0) return null;

  const mid = Math.floor(prices.length / 2);
  return prices[mid];
}

// ─────────────────────────────────────
// OFFER ENGINE 🔥
// ─────────────────────────────────────
function getOfferStrategy(price, market, roiTarget = 0.2) {
  if (!market) return null;

  const maxBuy = market * (1 - roiTarget);

  return {
    startOffer: +(maxBuy * 0.8).toFixed(2),
    maxOffer: +maxBuy.toFixed(2),
    targetProfit: +(market - maxBuy).toFixed(2)
  };
}

// ─────────────────────────────────────
// SEARCH
// ─────────────────────────────────────
async function browse(q) {
  const token = await getToken();

  const res = await fetch(
    "https://api.ebay.com/buy/browse/v1/item_summary/search?q=" + encodeURIComponent(q) + "&limit=50",
    {
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
      }
    }
  );

  const json = await res.json();

  return (json.itemSummaries || [])
    .map(i => ({
      title: i.title,
      price: parseFloat(i.price?.value || 0),
      url: i.itemWebUrl,
      bestOffer: i.buyingOptions?.includes("BEST_OFFER") || false
    }))
    .filter(i => i.price > 5)
    .filter(i => isValid(i.title));
}

// ─────────────────────────────────────
// ROUTES
// ─────────────────────────────────────
app.get("/scan", async (req, res) => {
  try {
    const query = req.query.binQ || "bowman chrome auto";

    const listings = await browse(query);

    const marketPrice = getMarketPrice(listings);

    const deals = listings.map(l => {
      const strategy = getOfferStrategy(l.price, marketPrice);

      return {
        ...l,
        marketPrice,
        offer: strategy
      };
    });

    res.json({
      count: deals.length,
      marketPrice,
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
  console.log("ENGINE RUNNING");
});
