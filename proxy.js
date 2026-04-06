const express = require("express");
const cors    = require("cors");
const fetch   = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

const app    = express();
const PORT   = process.env.PORT || 8080;

const APP_ID  = "MatthewP-SportsCa-PRD-eaff948e3-fa21b2a9";
const USER_TOKEN = "v^1.1#i^1#r^0#I^3#p^3#f^0#t^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";

const FINDING_BASE = "https://svcs.ebay.com/services/search/FindingService/v1";

app.use(cors());
app.use(express.json());

// ── Finding API — active BIN listings ────────────────────────────────────────
async function findingSearch(keywords, maxPrice, maxResults) {
  const params = new URLSearchParams();
  params.set("OPERATION-NAME",       "findItemsAdvanced");
  params.set("SERVICE-VERSION",      "1.13.0");
  params.set("SECURITY-APPNAME",     APP_ID);
  params.set("RESPONSE-DATA-FORMAT", "JSON");
  params.set("keywords",             keywords);
  params.set("categoryId",           "212");
  params.set("paginationInput.entriesPerPage", String(maxResults || 10));
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

// ── Browse API helper ─────────────────────────────────────────────────────────
async function browseAPI(endpoint, params) {
  const url = `https://api.ebay.com/buy/browse/v1/${endpoint}?` + new URLSearchParams(params);
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${USER_TOKEN}`,
      "Content-Type":  "application/json",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Browse ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

// ── Terapeak sold data ────────────────────────────────────────────────────────
async function terap(keywords) {
  const url = "https://api.ebay.com/sell/analytics/v1/terapeak_product_sales?" +
    new URLSearchParams({ q: keywords, category_id: "212" });
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${USER_TOKEN}`,
      "Content-Type":  "application/json",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    }
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Terapeak ${res.status}: ${txt.slice(0,200)}`);
  return JSON.parse(txt);
}

// Strict title filter — must match 75% of meaningful search terms
function strictFilter(items, keywords, maxPrice) {
  const stop = new Set(["the","and","for","gem","mint","qty","lot","pack","break","card","cards"]);
  const terms = keywords.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  return items.filter(i => {
    if (i.price <= 0) return false;
    if (maxPrice && i.price > maxPrice) return false;
    const t = i.title.toLowerCase();
    return terms.filter(w => t.includes(w)).length >= Math.ceil(terms.length * 0.75);
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/bin", async (req, res) => {
  const { q, maxPrice } = req.query;
  if (!q) return res.status(400).json({ error: "q required" });
  const mp = maxPrice ? parseFloat(maxPrice) : null;
  try {
    let items = await findingSearch(q, mp, 10);
    if (!items.length) {
      const json = await browseAPI("item_summary/search", {
        q, category_ids:"212",
        filter: "buyingOptions:{FIXED_PRICE}" + (mp ? `,price:[..${mp}]` : ""),
        sort:"price", limit:"10"
      });
      items = strictFilter((json.itemSummaries || []).map(i => ({
        itemId:i.itemId, title:i.title,
        price:parseFloat(i.price?.value||"0"),
        url:i.itemWebUrl, seller:i.seller?.username,
      })), q, mp);
    }
    res.json({ items });
  } catch(e) { console.error("/bin:",e.message); res.status(500).json({ error:e.message }); }
});

app.get("/sold", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "q required" });
  try {
    // Try Terapeak first
    const tp = await terap(q);
    console.log("Terapeak raw:", JSON.stringify(tp).slice(0,300));
    if (tp.salesHistogram || tp.averageSellPrice || (tp.salesData && tp.salesData.length)) {
      // Extract prices from Terapeak response
      const prices = [];
      if (tp.averageSellPrice?.value) prices.push({ title: q, price: parseFloat(tp.averageSellPrice.value) });
      (tp.salesData || []).forEach(s => {
        if (s.averageSalePrice?.value) prices.push({ title: s.categoryName || q, price: parseFloat(s.averageSalePrice.value) });
      });
      if (prices.length) return res.json({ items: prices, source: "terapeak" });
    }
    throw new Error("No Terapeak data");
  } catch(tpErr) {
    console.log("Terapeak failed:", tpErr.message, "— falling back to Browse API");
    try {
      const json = await browseAPI("item_summary/search", {
        q, category_ids:"212",
        filter:"buyingOptions:{FIXED_PRICE}",
        sort:"price", limit:"20"
      });
      const items = strictFilter((json.itemSummaries || []).map(i => ({
        itemId:i.itemId, title:i.title,
        price:parseFloat(i.price?.value||"0"),
        url:i.itemWebUrl, seller:i.seller?.username,
      })), q, null);
      res.json({ items, source:"browse", terapeak_err: tpErr.message });
    } catch(e) { res.status(500).json({ error:e.message }); }
  }
});

app.get("/test", async (req, res) => {
  const q = req.query.q || "Patrick Mahomes 2017 Panini Prizm 269 PSA 10";
  const results = {};
  try { results.finding = await findingSearch(q, 500, 3); } catch(e) { results.finding = { error: e.message }; }
  try { results.terapeak = await terap(q); } catch(e) { results.terapeak = { error: e.message }; }
  try {
    const json = await browseAPI("item_summary/search", { q, category_ids:"212", filter:"buyingOptions:{FIXED_PRICE}", limit:"5" });
    results.browse = (json.itemSummaries||[]).slice(0,3).map(i=>({ title:i.title, price:i.price?.value }));
  } catch(e) { results.browse = { error: e.message }; }
  res.json(results);
});

app.get("/ping", (_, res) => res.json({ ok: true }));
app.get("/",    (_, res) => res.json({ service: "CARDARB proxy", status: "running" }));

app.listen(PORT, () => console.log(`CARDARB proxy on port ${PORT}`));
