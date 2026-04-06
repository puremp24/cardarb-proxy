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

async function getToken() {
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

  const text = await res.text(); // 🔥 raw response

  console.log("EBAY TOKEN RESPONSE:", text);

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON from eBay: " + text);
  }

  if (!res.ok) {
    throw new Error("Token failed: " + JSON.stringify(data));
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 120) * 1000;

  return cachedToken;
}

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
    title: i.title,
    price: parseFloat(i.price?.value || 0),
    url: i.itemWebUrl,
    bestOffer: i.buyingOptions?.includes("BEST_OFFER") || false
  }));
}

app.get("/ping", (req, res) => {
  res.json({ ok: true });
});

app.get("/scan", async (req, res) => {
  try {
    const listings = await browse("baseball cards");

    res.json({ listings });

  } catch (e) {
    console.error("FULL ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log("SERVER RUNNING");
});
