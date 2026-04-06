const express = require("express");
const cors    = require("cors");
const fetch   = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

const app    = express();
const PORT   = process.env.PORT || 8080;
const APP_ID = "MatthewP-SportsCa-PRD-eaff948e3-fa21b2a9";

// eBay OAuth user token
const USER_TOKEN = "v^1.1#i^1#I^3#r^0#p^3#f^0#t^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";

const FINDING_BASE = "https://svcs.ebay.com/services/search/FindingService/v1";

app.use(cors());
app.use(express.json());

// ── Finding API (active BIN listings) ────────────────────────────────────────
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
    itemId:  i.itemId?.[0],
    title:   i.title?.[0],
    price:   parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.["__value__"] || "0"),
    url:     i.viewItemURL?.[0],
    seller:  i.sellerInfo?.[0]?.sellerUserName?.[0],
  })).filter(i => i.price > 0 && (!maxPrice || i.price <= maxPrice));
}

// ── Browse API (sold comps via OAuth token) ───────────────────────────────────
async function browseSearch(keywords, maxResults) {
  const url = "https://api.ebay.com/buy/browse/v1/item_summary/search?" + new URLSearchParams({
    q:          keywords,
    category_ids: "212",
    filter:     "buyingOptions:{FIXED_PRICE},conditions:{USED}",
    sort:       "endingSoonest",
    limit:      String(maxResults || 10),
  });

  const res  = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${USER_TOKEN}`,
      "Content-Type":  "application/json",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    }
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Browse API ${res.status}: ${txt.slice(0,150)}`);
  }

  const json = await res.json();
  return (json.itemSummaries || []).map(i => ({
    itemId: i.itemId,
    title:  i.title,
    price:  parseFloat(i.price?.value || "0"),
    url:    i.itemWebUrl,
    seller: i.seller?.username,
  })).filter(i => i.price > 0);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Active BIN listings — Finding API
app.get("/bin", async (req, res) => {
  const { q, maxPrice } = req.query;
  if (!q) return res.status(400).json({ error: "q required" });
  try {
    const items = await findingSearch(q, maxPrice ? parseFloat(maxPrice) : null, 10);
    res.json({ items });
  } catch (e) {
    console.error("/bin:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Sold comps — Browse API with user token
app.get("/sold", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "q required" });
  try {
    const items = await browseSearch(q, 10);
    res.json({ items });
  } catch (e) {
    console.error("/sold:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Test endpoint
app.get("/test", async (req, res) => {
  const q = req.query.q || "Patrick Mahomes Prizm PSA 10";
  try {
    const [bin, sold] = await Promise.all([
      findingSearch(q, 500, 3),
      browseSearch(q, 3),
    ]);
    res.json({ bin, sold, binCount: bin.length, soldCount: sold.length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/ping", (_, res) => res.json({ ok: true }));
app.get("/",    (_, res) => res.json({ service: "CARDARB proxy", status: "running" }));

app.listen(PORT, () => console.log(`CARDARB proxy on port ${PORT}`));
