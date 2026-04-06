const express = require("express");
const cors    = require("cors");
const fetch   = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

const app    = express();
const PORT   = process.env.PORT || 8080;
const APP_ID = process.env.EBAY_APP_ID || "MatthewP-SportsCa-PRD-eaff948e3-fa21b2a9";
const BASE   = "https://svcs.ebay.com/services/search/FindingService/v1";

app.use(cors());
app.use(express.json());

async function ebayFind(operation, keywords, filters, maxResults) {
  const params = new URLSearchParams();
  params.set("OPERATION-NAME",       operation);
  params.set("SERVICE-VERSION",      "1.13.0");
  params.set("SECURITY-APPNAME",     APP_ID);
  params.set("RESPONSE-DATA-FORMAT", "JSON");
  params.set("REST-PAYLOAD",         "");
  params.set("keywords",             keywords);
  params.set("categoryId",           "212");
  params.set("paginationInput.entriesPerPage", String(maxResults || 10));
  params.set("outputSelector(0)",    "SellerInfo");

  let fi = 0;
  for (const [name, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      value.forEach((v, vi) => {
        params.set(`itemFilter(${fi}).name`,         name);
        params.set(`itemFilter(${fi}).value(${vi})`, v);
      });
    } else {
      params.set(`itemFilter(${fi}).name`,  name);
      params.set(`itemFilter(${fi}).value`, value);
    }
    fi++;
  }

  const url = `${BASE}?${params.toString()}`;
  const res = await fetch(url);
  const txt = await res.text();

  let json;
  try { json = JSON.parse(txt); }
  catch(e) { throw new Error("eBay non-JSON: " + txt.slice(0, 200)); }

  const respKey = operation === "findCompletedItems"
    ? "findCompletedItemsResponse"
    : "findItemsAdvancedResponse";

  const ack = json?.[respKey]?.[0]?.ack?.[0];
  if (ack === "Failure") {
    const errMsg = json?.[respKey]?.[0]?.errorMessage?.[0]?.error?.[0]?.message?.[0] || "eBay API error";
    throw new Error(errMsg);
  }

  return json;
}

function parseItems(json, op) {
  const key   = op === "findCompletedItems"
    ? "findCompletedItemsResponse"
    : "findItemsAdvancedResponse";
  const items = json?.[key]?.[0]?.searchResult?.[0]?.item || [];
  return items.map(i => ({
    itemId:    i.itemId?.[0],
    title:     i.title?.[0],
    price:     parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.["__value__"] || "0"),
    url:       i.viewItemURL?.[0],
    seller:    i.sellerInfo?.[0]?.sellerUserName?.[0],
    condition: i.condition?.[0]?.conditionDisplayName?.[0],
  })).filter(i => i.price > 0);
}

app.get("/bin", async (req, res) => {
  const { q, maxPrice } = req.query;
  if (!q) return res.status(400).json({ error: "q required" });
  try {
    const json  = await ebayFind("findItemsAdvanced", q, {
      "ListingType": "FixedPrice",
      "MaxPrice":    maxPrice || "500",
    }, 10);
    const items = parseItems(json, "findItemsAdvanced")
      .filter(i => !maxPrice || i.price <= parseFloat(maxPrice));
    res.json({ items });
  } catch (e) {
    console.error("/bin error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/sold", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "q required" });
  try {
    const json  = await ebayFind("findCompletedItems", q, {
      "ListingType":   "FixedPrice",
      "SoldItemsOnly": "true",
    }, 10);
    const items = parseItems(json, "findCompletedItems");
    res.json({ items });
  } catch (e) {
    console.error("/sold error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Test endpoint — shows exactly what eBay returns for a search
app.get("/test", async (req, res) => {
  const q = req.query.q || "Patrick Mahomes 2017 Panini Prizm PSA 10";
  try {
    const params = new URLSearchParams();
    params.set("OPERATION-NAME",       "findItemsAdvanced");
    params.set("SERVICE-VERSION",      "1.13.0");
    params.set("SECURITY-APPNAME",     APP_ID);
    params.set("RESPONSE-DATA-FORMAT", "JSON");
    params.set("keywords",             q);
    params.set("categoryId",           "212");
    params.set("itemFilter(0).name",   "ListingType");
    params.set("itemFilter(0).value",  "FixedPrice");
    params.set("paginationInput.entriesPerPage", "3");
    const r   = await fetch(`${BASE}?${params}`);
    const txt = await r.text();
    res.setHeader("Content-Type", "application/json");
    res.send(txt);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/ping", (_, res) => res.json({ ok: true, appId: APP_ID.slice(0,20) + "..." }));
app.get("/",    (_, res) => res.json({ service: "CARDARB proxy", status: "running" }));

app.listen(PORT, () => console.log(`CARDARB proxy on port ${PORT}`));
