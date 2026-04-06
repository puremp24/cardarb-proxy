const express = require("express");
const cors    = require("cors");
const fetch   = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

const app  = express();
const PORT = process.env.PORT || 8080;

const CLIENT_ID     = "MatthewP-SportsCa-PRD-eaff948e3-fa21b2a9";
const CLIENT_SECRET = "PRD-4c5917911fc5-8272-4952-abb6-3194";
const REFRESH_TOKEN = "v^1.1#i^1#r^0#p^3#I^3#f^0#t^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";

const FINDING_BASE = "https://svcs.ebay.com/services/search/FindingService/v1";

app.use(cors());
app.use(express.json());

// ── OAuth token management ────────────────────────────────────────────────────
let accessToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  console.log("Refreshing eBay access token...");
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res   = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method:  "POST",
    headers: {
      "Authorization": `Basic ${creds}`,
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: REFRESH_TOKEN,
      scope: [
        "https://api.ebay.com/oauth/api_scope",
        "https://api.ebay.com/oauth/api_scope/buy.item.summary",
        "https://api.ebay.com/oauth/api_scope/sell.analytics.readonly",
      ].join(" "),
    }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Token refresh ${res.status}: ${txt.slice(0,200)}`);
  const data  = JSON.parse(txt);
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 120) * 1000;
  console.log("Token refreshed, expires in", data.expires_in, "seconds");
  return accessToken;
}

// ── eBay Finding API — active BIN listings ────────────────────────────────────
async function getBIN(keywords, maxPrice) {
  const params = new URLSearchParams();
  params.set("OPERATION-NAME",       "findItemsAdvanced");
  params.set("SERVICE-VERSION",      "1.13.0");
  params.set("SECURITY-APPNAME",     CLIENT_ID);
  params.set("RESPONSE-DATA-FORMAT", "JSON");
  params.set("keywords",             keywords);
  params.set("categoryId",           "212");
  params.set("paginationInput.entriesPerPage", "10");
  params.set("outputSelector(0)",    "SellerInfo");
  params.set("itemFilter(0).name",   "ListingType");
  params.set("itemFilter(0).value",  "FixedPrice");
  if (maxPrice) {
    params.set("itemFilter(1).name",  "MaxPrice");
    params.set("itemFilter(1).value", String(maxPrice));
  }
  const res  = await fetch(`${FINDING_BASE}?${params}`);
  const json = await res.json();
  const items = json?.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item || [];
  return items.map(i => ({
    itemId: i.itemId?.[0],
    title:  i.title?.[0],
    price:  parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.["__value__"] || "0"),
    url:    i.viewItemURL?.[0],
    seller: i.sellerInfo?.[0]?.sellerUserName?.[0],
  })).filter(i => i.price > 0 && (!maxPrice || i.price <= maxPrice));
}

// ── eBay Browse API ───────────────────────────────────────────────────────────
async function browseSearch(keywords, maxPrice) {
  const token  = await getToken();
  const filter = ["buyingOptions:{FIXED_PRICE}", maxPrice ? `price:[..${maxPrice}]` : ""].filter(Boolean).join(",");
  const url    = "https://api.ebay.com/buy/browse/v1/item_summary/search?" + new URLSearchParams({
    q: keywords, category_ids: "212", filter, sort: "price", limit: "20",
  });
  const res  = await fetch(url, { headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" } });
  const txt  = await res.text();
  if (!res.ok) throw new Error(`Browse ${res.status}: ${txt.slice(0,150)}`);
  const json = JSON.parse(txt);

  // Strict title match — must contain 75%+ of key search terms
  const stop  = new Set(["the","and","for","gem","mint","qty","lot","pack","break","card","cards","rc"]);
  const terms = keywords.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stop.has(w));

  return (json.itemSummaries || []).map(i => ({
    itemId: i.itemId, title: i.title,
    price:  parseFloat(i.price?.value || "0"),
    url:    i.itemWebUrl, seller: i.seller?.username,
  })).filter(i => {
    if (i.price <= 0 || (maxPrice && i.price > maxPrice)) return false;
    const t = i.title.toLowerCase();
    return terms.filter(w => t.includes(w)).length >= Math.ceil(terms.length * 0.75);
  });
}

// ── Terapeak sold data ────────────────────────────────────────────────────────
async function getTerapeak(keywords) {
  const token = await getToken();
  const url   = "https://api.ebay.com/sell/analytics/v1/terapeak_product_sales?" +
    new URLSearchParams({ q: keywords, category_id: "212" });
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Terapeak ${res.status}: ${txt.slice(0,200)}`);
  return JSON.parse(txt);
}

// ── Main scan endpoint — returns deals for one card target ────────────────────
app.get("/scan", async (req, res) => {
  const { binQ, soldQ, maxPrice } = req.query;
  if (!binQ || !soldQ) return res.status(400).json({ error: "binQ and soldQ required" });
  const mp = maxPrice ? parseFloat(maxPrice) : 500;

  try {
    // Get active BIN listings
    let listings = await getBIN(binQ, mp);
    if (!listings.length) listings = await browseSearch(binQ, mp);

    // Get sold comps from Terapeak
    let avgSold = null;
    let soldComps = [];
    let compSource = "none";

    try {
      const tp = await getTerapeak(soldQ);
      console.log("Terapeak response keys:", Object.keys(tp));
      // Try to extract average sold price from various Terapeak response shapes
      if (tp.averageSellPrice?.value) {
        avgSold   = parseFloat(tp.averageSellPrice.value);
        compSource = "terapeak";
      } else if (tp.salesData?.length) {
        const prices = tp.salesData.map(s => parseFloat(s.averageSalePrice?.value || 0)).filter(p => p > 0);
        if (prices.length) { avgSold = prices.reduce((a,b)=>a+b,0)/prices.length; compSource = "terapeak"; }
      } else if (tp.total?.value) {
        avgSold   = parseFloat(tp.total.value);
        compSource = "terapeak";
      }
      // Log full response for debugging
      console.log("Terapeak full:", JSON.stringify(tp).slice(0,500));
    } catch(tpErr) {
      console.log("Terapeak err:", tpErr.message);
    }

    // Fallback: use Browse API prices as comp proxy if Terapeak fails
    if (!avgSold) {
      const browseItems = await browseSearch(soldQ, null);
      soldComps = browseItems.map(i => i.price).filter(p => p > 0).slice(0, 10);
      if (soldComps.length >= 2) {
        // Use median to reduce outlier impact
        soldComps.sort((a,b)=>a-b);
        avgSold = soldComps[Math.floor(soldComps.length/2)];
        compSource = "browse_median";
      }
    }

    res.json({ listings, avgSold, soldComps, compSource });
  } catch(e) {
    console.error("/scan error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Test endpoint ─────────────────────────────────────────────────────────────
app.get("/test", async (req, res) => {
  const q = req.query.q || "Patrick Mahomes 2017 Panini Prizm 269 PSA 10";
  const out = {};
  try { out.token = "ok"; await getToken(); } catch(e) { out.token = e.message; }
  try { out.finding = await getBIN(q, 500); } catch(e) { out.finding = { error: e.message }; }
  try { out.terapeak = await getTerapeak(q); } catch(e) { out.terapeak = { error: e.message }; }
  try { out.browse = await browseSearch(q, 500); } catch(e) { out.browse = { error: e.message }; }
  res.json(out);
});

app.get("/ping", (_, res) => res.json({ ok: true }));
app.get("/",    (_, res) => res.json({ service: "CARDARB proxy", status: "running" }));

app.listen(PORT, () => console.log(`CARDARB proxy on port ${PORT}`));
