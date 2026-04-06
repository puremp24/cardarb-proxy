const express = require("express");
const cors    = require("cors");
const fetch   = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

const app  = express();
const PORT = process.env.PORT || 8080;

const CLIENT_ID     = "MatthewP-SportsCa-PRD-eaff948e3-fa21b2a9";
const CLIENT_SECRET = "PRD-4c5917911fc5-8272-4952-abb6-3194";
const REFRESH_TOKEN = "v^1.1#i^1#p^3#I^3#r^1#f^0#t^Ul4xMF8xOjhGRjQ1OUNEMDM2RTE0M0RGMkVEOEFGQTg4NDVGOTc1XzJfMSNFXjI2MA==";

app.use(cors());
app.use(express.json());

// ── Token management ──────────────────────────────────────────────────────────
let cachedToken = null, tokenExpiry = 0;
async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res   = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { "Authorization": `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body:   new URLSearchParams({ grant_type: "refresh_token", refresh_token: REFRESH_TOKEN }),
  });
  const data  = await res.json();
  if (!res.ok) throw new Error(`Token: ${data.error_description}`);
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 120) * 1000;
  return cachedToken;
}

// ── Browse API search ─────────────────────────────────────────────────────────
async function browse(q, maxPrice, limit) {
  const token  = await getToken();
  const filter = ["buyingOptions:{FIXED_PRICE}", maxPrice ? `price:[..${maxPrice}]` : ""].filter(Boolean).join(",");
  const res    = await fetch(
    "https://api.ebay.com/buy/browse/v1/item_summary/search?" + new URLSearchParams({
      q, category_ids: "212", filter, sort: "price", limit: String(limit || 20),
    }),
    { headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" } }
  );
  const json = await res.json();
  return (json.itemSummaries || []).map(i => ({
    itemId: i.itemId,
    title:  i.title,
    price:  parseFloat(i.price?.value || "0"),
    url:    i.itemWebUrl,
    seller: i.seller?.username,
    image:  i.image?.imageUrl || null,
  })).filter(i => i.price > 0 && (!maxPrice || i.price <= maxPrice));
}

// ── Strict title filter ───────────────────────────────────────────────────────
function strictFilter(items, keywords, maxPrice) {
  const stop     = new Set(["the","and","for","gem","mint","qty","lot","pack","break","card","cards","new","other"]);
  const terms    = keywords.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  // Words that indicate a different card type — exclude if found in title but NOT in search
  const badWords = ["generation","refractor","prizm","optic","mosaic","select","insert","parallel","gold","silver","chrome","sapphire","aqua","pink","green","orange","purple","red","blue","wave","disco","hyper","laser","mojo","speckle","shimmer","cracked","ice"];
  const searchHasBad = badWords.filter(w => keywords.toLowerCase().includes(w));

  return items.filter(i => {
    if (i.price <= 0) return false;
    if (maxPrice && i.price > maxPrice) return false;
    const t = i.title.toLowerCase();
    // Must match ALL key terms
    if (!terms.every(w => t.includes(w))) return false;
    // Reject if title has bad words that aren't in the search query
    const titleBad = badWords.filter(w => t.includes(w) && !searchHasBad.includes(w));
    if (titleBad.length > 0) return false;
    return true;
  });
}

// ── 130point sold comps ───────────────────────────────────────────────────────
async function getSoldComps(keywords) {
  try {
    const url = "https://www.130point.com/sales/?" + new URLSearchParams({
      query: keywords,
      format: "json",
    });
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
    });
    if (!res.ok) throw new Error("130point " + res.status);
    const json = await res.json();
    const sales = (json.sales || json.results || []);
    return sales
      .map(s => parseFloat(s.price || s.sale_price || s.amount || 0))
      .filter(p => p > 0)
      .sort((a,b) => a-b);
  } catch(e) {
    console.log("130point failed:", e.message);
    return [];
  }
}
// Returns active BIN listings + market price derived from broader search
app.get("/scan", async (req, res) => {
  const { binQ, soldQ, maxPrice } = req.query;
  if (!binQ) return res.status(400).json({ error: "binQ required" });
  const mp    = parseFloat(maxPrice) || 500;
  const compQ = soldQ || binQ;

  try {
    // 1. Active BIN listings
    const rawListings = await browse(binQ, mp, 20);
    const listings    = strictFilter(rawListings, binQ, mp);

    // 2. Try 130point for real sold comps first
    let compItems  = await getSoldComps(compQ);
    let compSource = "130point";

    // 3. Fall back to Browse API median if not enough results
    if (compItems.length < 3) {
      const compRaw = await browse(compQ, null, 50);
      compItems  = strictFilter(compRaw, compQ, null).map(i => i.price).filter(p => p > 0).sort((a,b)=>a-b);
      compSource = "browse_active";
    }

    // Use median
    let marketPrice = null;
    if (compItems.length >= 2) {
      const mid = Math.floor(compItems.length / 2);
      marketPrice = compItems[mid];
    }

    res.json({ listings, marketPrice, compCount: compItems.length, compSample: compItems.slice(0,8), compSource });
  } catch(e) {
    console.error("/scan:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/ping", (_, res) => res.json({ ok: true }));
app.get("/",    (_, res) => res.json({ service: "CARDARB proxy", status: "running" }));
app.listen(PORT, () => console.log(`CARDARB proxy on port ${PORT}`));
