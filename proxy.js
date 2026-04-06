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
// FILTER
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

    t.includes("ip auto") ||
    t.includes("in person auto") ||
    t.includes("hand signed") ||
    t.includes("paper auto") ||
    t.includes("custom auto") ||
    t.includes("leaf") ||
    t.includes("facsimile")
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
// COMP QUERY
// ─────────────────────────────────────
function buildCompQuery(title) {
  return `${getPlayer(title)} bowman chrome auto`;
}

// ─────────────────────────────────────
// GET COMPS
// ─────────────────────────────────────
async function getComps(token, title) {
  const query = buildCompQuery(title);

  const res = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=15`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
      }
    }
  );

  const json = await res.json();

  let prices = (json.itemSummaries || [])
    .filter(i => {
      const t = i.title.toLowerCase();
      return t.includes("auto") && t.includes("bowman") && !isJunk(t);
    })
    .map(i => parseFloat(i.price?.value || 0))
    .filter(p => p > 5)
    .sort((a, b) => a - b);

  if (prices.length < 3) return null;

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
    `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=25`,
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
// LIQUID PLAYER POOL 🔥
// ─────────────────────────────────────
const LIQUID_PLAYERS = [
  "walker jenkins",
  "dylan crews",
  "paul skenes",
  "james wood",
  "jackson holliday",
  "elijah green",
  "max clark",
  "colt emerson",
  "cam collier",
  "kyle teel",
  "jacob wilson"
];

// ─────────────────────────────────────
// CORE ENGINE (ITERATIVE 🔥)
// ─────────────────────────────────────
async function findDeals(token, target = 10) {
  const deals = [];
  const seen = new Set();

  const queryTiers = [
    // Tier 1: liquid players
    LIQUID_PLAYERS.map(p => `${p} bowman chrome auto`),

    // Tier 2: broader
    [
      "bowman chrome 1st auto",
      "bowman draft chrome auto",
      "bowman chrome prospect auto"
    ],

    // Tier 3: wide net
    [
      "bowman auto",
      "bowman chrome auto"
    ]
  ];

  for (const tier of queryTiers) {
    for (const query of tier) {
      const items = await searchEbay(token, query);

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

        if (deals.length >= target) return deals;
      }
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

    const deals = await findDeals(token, 12);

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
  console.log("LIQUIDITY ENGINE LIVE");
});
