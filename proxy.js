const express = require("express");
const cors    = require("cors");
const fetch   = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

const app    = express();
const PORT   = process.env.PORT || 8080;

const APP_ID  = "MatthewP-SportsCa-PRD-eaff948e3-fa21b2a9";
const USER_TOKEN = "v^1.1#i^1#r^0#p^3#f^0#I^3#t^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";

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
