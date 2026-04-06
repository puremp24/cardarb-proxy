const express = require("express");
const cors    = require("cors");
const fetch   = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

const app  = express();
const PORT = process.env.PORT || 8080;

const CLIENT_ID     = "MatthewP-SportsCa-PRD-eaff948e3-fa21b2a9";
const CLIENT_SECRET = "PRD-4c5917911fc5-8272-4952-abb6-3194";
const REFRESH_TOKEN = "v^1.1#i^1#p^3#I^3#r^1#f^0#t^Ul4xMF8xOjhGRjQ1OUNEMDM2RTE0M0RGMkVEOEFGQTg4NDVGOTc1XzJfMSNFXjI2MA==";

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
  // Try both endpoint versions
  const endpoints = [
    "https://api.ebay.com/sell/analytics/v1/terapeak_product_sales",
    "https://api.ebay.com/sell/analytics/v1_beta/terapeak_product_sales",
  ];
  for (const base of endpoints) {
    const url = base + "?" + new URLSearchParams({ q: keywords, category_id: "212" });
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US", "Content-Type": "application/json" }
    });
    const txt = await res.text();
    console.log(`Terapeak ${base} -> ${res.status}: ${txt.slice(0,200)}`);
    if (res.ok) return JSON.parse(txt);
  }
  throw new Error("Terapeak not available on this account tier");
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
  const q = req.query.q || "Mahomes 2017 Prizm PSA 10";
  const out = {};
  try { await getToken(); out.token = "ok"; } catch(e) { out.token = e.message; }
  try { out.finding = await getBIN(q, 500); } catch(e) { out.finding = { error: e.message }; }
  try { out.terapeak = await getTerapeak(q); } catch(e) { out.terapeak = { error: e.message }; }
  try { out.browse = await browseSearch(q, 500); } catch(e) { out.browse = { error: e.message }; }
  res.json(out);
});


// One-time auth code exchange
app.get("/auth", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: "code required" });
  try {
    const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    const r = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type:   "authorization_code",
        code:         code,
        redirect_uri: "Matthew_Pells-MatthewP-Sports-sredt",
      }),
    });
    const txt = await r.text();
    const data = JSON.parse(txt);
    res.json({
      access_token:  data.access_token ? data.access_token.slice(0,50)+"..." : null,
      refresh_token: data.refresh_token || null,
      expires_in:    data.expires_in,
      refresh_token_expires_in: data.refresh_token_expires_in,
      error:         data.error || null,
      error_description: data.error_description || null,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/ping", (_, res) => res.json({ ok: true }));
app.get("/",    (_, res) => res.json({ service: "CARDARB proxy", status: "running" }));

app.listen(PORT, () => console.log(`CARDARB proxy on port ${PORT}`));
