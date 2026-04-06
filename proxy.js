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

  if (!res.ok) {
    console.error("TOKEN ERROR:", data);
    throw new Error("Token failed");
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 120) * 1000;

  return cachedToken;
}

// ─────────────────────────────────────
// 🔥 FILTER LOGIC (THIS IS HUGE)
// ─────────────────────────────────────
function isValidCard(title) {
  const t = title.toLowerCase();

  // ❌ REMOVE JUNK
  if (
    t.includes("lot") ||
    t.includes("bulk") ||
    t.includes("pack") ||
    t.includes("box") ||
    t.includes("complete set") ||
    t.includes("you pick") ||
    t.includes("your pick") ||
    t.includes("team set") ||
    t.includes("divider") ||
    t.includes("holder") ||
    t.includes("supplies")
  ) return false;

  // ❌ REMOVE LOW VALUE BASE
  if (
    t.includes("base card") ||
    t.includes("singles") ||
    t.includes("insert set")
  ) return false;

  return true;
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
    .filter(i => i.price > 5)           // remove junk cheap cards
    .filter(i => isValidCard(i.title)); // 🔥 filter junk
}

// ─────────────────────────────────────
// ROUTES
// ─────────────────────────────────────
app.get("/ping", (req, res) => {
  res.json({ ok: true });
});

app.get("/scan", async (req, res) => {
  try {
    const query = req.query.binQ || "bowman chrome auto";

    const listings = await browse(query);

    res.json({
      listings,
      count: listings.length
    });

  } catch (e) {
    console.error("SCAN ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────
app.listen(PORT, () => {
  console.log("CARDARB LIVE");
});
