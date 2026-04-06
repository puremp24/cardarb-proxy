const express = require("express");
const cors    = require("cors");
const fetch   = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

const app    = express();
const PORT   = process.env.PORT || 8080;
const APP_ID = process.env.EBAY_APP_ID || "MatthewP-SportsCa-PRD-eaff948e3-fa21b2a9";
const BASE   = "https://svcs.ebay.com/services/search/FindingService/v1";

app.use(cors());
app.use(express.json());

async function ebayFind(operation, extra) {
  const params = new URLSearchParams({
    "OPERATION-NAME":       operation,
    "SERVICE-VERSION":      "1.13.0",
    "SECURITY-APPNAME":     APP_ID,
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD":         "",
    ...extra,
  });
  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error("eBay HTTP " + res.status);
  return res.json();
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
    image:     i.galleryURL?.[0],
  })).filter(i => i.price > 0);
}

// Active BIN listings
app.get("/bin", async (req, res) => {
  const { q, maxPrice, minPrice } = req.query;
  if (!q) return res.status(400).json({ error: "q required" });
  try {
    const json  = await ebayFind("findItemsAdvanced", {
      "keywords":                       q,
      "categoryId":                     "212",
      "itemFilter(0).name":             "ListingType",
      "itemFilter(0).value":            "FixedPrice",
      "itemFilter(1).name":             "MinPrice",
      "itemFilter(1).value":            minPrice || "1",
      "itemFilter(1).paramName":        "Currency",
      "itemFilter(1).paramValue":       "USD",
      "itemFilter(2).name":             "MaxPrice",
      "itemFilter(2).value":            maxPrice || "500",
      "itemFilter(2).paramName":        "Currency",
      "itemFilter(2).paramValue":       "USD",
      "sortOrder":                      "PricePlusShippingLowest",
      "paginationInput.entriesPerPage": "10",
      "outputSelector(0)":              "SellerInfo",
      "outputSelector(1)":              "GalleryInfo",
    });
    res.json({ items: parseItems(json, "findItemsAdvanced") });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Completed BIN sold comps
app.get("/sold", async (req, res) => {
  const { q, maxPrice } = req.query;
  if (!q) return res.status(400).json({ error: "q required" });
  try {
    const json  = await ebayFind("findCompletedItems", {
      "keywords":                       q,
      "categoryId":                     "212",
      "itemFilter(0).name":             "ListingType",
      "itemFilter(0).value":            "FixedPrice",
      "itemFilter(1).name":             "SoldItemsOnly",
      "itemFilter(1).value":            "true",
      "itemFilter(2).name":             "MaxPrice",
      "itemFilter(2).value":            maxPrice || "1000",
      "itemFilter(2).paramName":        "Currency",
      "itemFilter(2).paramValue":       "USD",
      "sortOrder":                      "EndTimeSoonest",
      "paginationInput.entriesPerPage": "10",
    });
    res.json({ items: parseItems(json, "findCompletedItems") });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/ping", (_, res) => res.json({ ok: true }));
app.get("/",    (_, res) => res.json({ service: "CARDARB proxy", status: "running" }));

app.listen(PORT, () => console.log(`CARDARB proxy running on port ${PORT}`));
