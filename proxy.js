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
// FILTER JUNK + FAKE AUTOS
// ─────────────────────────────────────
function isJunk(title) {
  const t = title.toLowerCase();

  return (
    t.includes("pack") ||
    t.includes("lot") ||
    t.includes("break") ||
    t.includes("pick") ||
    t.includes("team set") ||
    t.includes("read description") ||

    // 🔥 FAKE / NON-TRUE AUTOS
    t.includes("ip auto") ||
    t.includes("in person") ||
    t.includes("hand signed") ||
    t.includes("paper auto") ||
    t.includes("custom auto") ||
    t.includes("gtp") ||
    t.includes("leaf") ||
    t.includes("sticker auto")
  );
}

// ─────────────────────────────────────
// PLAYER EXTRACTION
// ─────────────────────────────────────
function getPlayer(title) {
  const words = title.split(" ");
  return words.slice(0, 2).join(" ").toLowerCase();
}

// ─────────────────────────────────────
// BUILD COMP QUERY
// ─────────────────────────────────────
function buildCompQuery(title) {
  const player = getPlayer(title);
  return `${player} bowman chrome auto`;
}

// ─────────────────────────────────────
// GET COMPS
// ─────────────────────────────────────
async function getComps(token, title) {
  const query = buildCompQuery(title);

  const res = await fetch(
    "https://api.ebay.com/buy/browse/v1/item_summary/search?q=" +
      encodeURIComponent(query) +
      "&limit=15",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
      }
    }
  );

  const json = await res.json();

  const filtered = (json.itemSummaries || []).filter(i => {
    const t = i.title.toLowerCase();

    return (
      t.includes("auto") &&
      t.includes("bowman") &&
      !isJunk(t)
    );
  });

  let prices = filtered
    .map(i => parseFloat(i.price?.value || 0))
    .filter(p => p > 5)
    .sort((a, b) => a - b);

  if (prices.length < 3) return null;

  // OUTLIER FILTER
  const min = prices[0];
  const max = prices[prices.length - 1];

  if (max > min * 3) {
    prices = prices.filter(p => p < min * 2);
  }

  if (prices.length < 3) return null;

  return prices[Math.floor(prices.length / 2)];
}

// ─────────────────────────────────────
// SEARCH EBAY
// ─────────────────────────────────────
async function searchEbay(token, query) {
  const res = await fetch(
    "https://api.ebay.com/buy/browse/v1/item_summary/search?q=" +
      encodeURIComponent(query) +
      "&limit=25",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
      }
    }
  );

  const json = await res.json();
  return json.itemSummaries || [];
}

// ─────────────────────────────────────
// CORE ENGINE
// ─────────────────────────────────────
async function findDeals(token, queries, targetCount = 10) {
  const deals = [];
  const seen = new Set();

  for (const q of queries) {
    const items = await searchEbay(token, q);

    for (const item of items) {
      if (seen.has(item.itemWebUrl)) continue;
      seen.add(item.itemWebUrl);

      const price = parseFloat(item.price?.value || 0);

      if (price < 10) continue;
      if (isJunk(item.title)) continue;

      const market = await getComps(token, item.title);
      if (!market) continue;

      const maxBuy = market * 0.85;

      if (price <= maxBuy) {
        deals.push({
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

      if (deals.length >= targetCount) return deals;
    }
  }

  return deals;
}

// ─────────────────────────────────────
// ROUTES
// ─────────────────────────────────────
app.get("/scan", async (req, res) => {
  try {
    const token = await getToken();

    const queries = [
      "bowman chrome 1st auto",
      "bowman chrome prospect auto",
      "bowman draft chrome auto",
      "bowman chrome refractor auto",
      "bowman 1st chrome auto"
    ];

    const deals = await findDeals(token, queries, 12);

    res.json({
      count: deals.length,
      deals
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/ping", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log("CLEAN ENGINE LIVE");
});
