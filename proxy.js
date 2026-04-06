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
// STRICT FILTER
// ─────────────────────────────────────
function isValidAuto(title) {
  const t = title.toLowerCase();

  return (
    t.includes("bowman chrome") &&
    t.includes("1st") &&
    t.includes("auto") &&

    !t.includes("signed") &&
    !t.includes("autographed") &&
    !t.includes("psa/dna") &&
    !t.includes("in person") &&
    !t.includes("ip auto") &&
    !t.includes("paper") &&
    !t.includes("leaf") &&
    !t.includes("custom")
  );
}

// ─────────────────────────────────────
// GRADE DETECTION
// ─────────────────────────────────────
function getGrade(title) {
  const t = title.toLowerCase();

  if (t.includes("psa 10")) return "psa10";
  if (t.includes("psa 9")) return "psa9";
  if (t.includes("sgc 10")) return "sgc10";
  if (t.includes("bgs 9.5")) return "bgs95";

  return "raw";
}

// ─────────────────────────────────────
// PLAYER
// ─────────────────────────────────────
function getPlayer(title) {
  return title.split(" ").slice(0, 2).join(" ").toLowerCase();
}

// ─────────────────────────────────────
// COMPS (SMART)
// ─────────────────────────────────────
async function getComps(token, title) {
  const grade = getGrade(title);
  let query = `${getPlayer(title)} bowman chrome 1st auto`;

  if (grade !== "raw") {
    query += ` ${grade.replace("psa", "psa ").replace("sgc", "sgc ")}`;
  }

  const res = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=20`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
      }
    }
  );

  const json = await res.json();

  let prices = (json.itemSummaries || [])
    .filter(i => isValidAuto(i.title))
    .map(i => parseFloat(i.price?.value || 0))
    .filter(p => p > 20)
    .sort((a, b) => a - b);

  if (prices.length < 3) return null;

  const min = prices[0];
  const max = prices[prices.length - 1];

  // 🔥 REMOVE BAD DATA
  if (max > min * 2.2) {
    prices = prices.filter(p => p < min * 1.8);
  }

  if (prices.length < 3) return null;

  return prices[Math.floor(prices.length / 2)];
}

// ─────────────────────────────────────
// SEARCH
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
// LIQUID PLAYERS
// ─────────────────────────────────────
const PLAYERS = [
  "walker jenkins",
  "dylan crews",
  "paul skenes",
  "jackson holliday",
  "james wood",
  "max clark",
  "colt emerson"
];

// ─────────────────────────────────────
// ENGINE
// ─────────────────────────────────────
async function findDeals(token) {
  const deals = [];
  const seen = new Set();

  for (const p of PLAYERS) {
    const items = await searchEbay(token, `${p} bowman chrome 1st auto`);

    for (const item of items) {
      if (seen.has(item.itemWebUrl)) continue;
      seen.add(item.itemWebUrl);

      const title = item.title;
      const price = parseFloat(item.price?.value || 0);

      if (!isValidAuto(title)) continue;
      if (price < 25) continue;

      const market = await getComps(token, title);
      if (!market) continue;

      const profit = market - price;
      const roi = profit / price;

      if (roi < 0.15 || profit < 20) continue;

      const maxOffer = +(market * 0.85).toFixed(2);
      const startOffer = +(price * 0.7).toFixed(2);

      deals.push({
        title,
        price,
        marketPrice: market,
        url: item.itemWebUrl,
        bestOffer: item.buyingOptions?.includes("BEST_OFFER") || false,
        offer: {
          startOffer,
          maxOffer,
          profit: +profit.toFixed(2),
          roi: +(roi * 100).toFixed(1) + "%"
        }
      });
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
    const deals = await findDeals(token);

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
  console.log("PRO ENGINE LIVE");
});
