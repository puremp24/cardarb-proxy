const express = require("express");
const cors    = require("cors");
const fetch   = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

const app  = express();
const PORT = process.env.PORT || 8080;

const CLIENT_ID     = "MatthewP-SportsCa-PRD-eaff948e3-fa21b2a9";
const CLIENT_SECRET = "PRD-aff948e3bc54-a151-4de0-ac66-7137";
const REFRESH_TOKEN = "v^1.1#i^1#r^0#I^3#p^3#f^0#t^H4sIAAAAAAAA/+1Zf2gb1x233bMdtyK9t2VI3yYqnJowlnPTuTnfSXSMzRXJizT+kSLKdhG7uu7t30tWnu/O9d7aV/WMCaVYaMhpmCOkY2S9q6B9d6QbLGhpoNjJSKHQ/2NqxwqB0+SdZC1vTLbTsnfwjirYmtmSIYNM/4t77/vp8f71fYLZr/Z6n+p+6uSnwQPv5WTDbHgiwG8D6rnV7N3e0b1/XBmoIAudnd812Hu+4tg/DsunIOYQd28KoZ6ZsWliuDsaDnmvJNsQGli1YRlgmqpxPDA3KXAjIjmsTW7XNYE86FQ9GdUXXWQCikItxksTSUWtJZsGOBxU9CliWVxQdISUCIZ3H2ENpCxNokXiQA5zIgAgDxAIQZD4qcyAk8eLRYM8ocrFhW5QkBIK9VXPlKq9bY+vdTYUYI5dQIcHedOJAPpNIp/qGC/vCNbJ6F/2QJ5B4+M6vpK2hnlFoeujuanCVWs57qoowDoZ7FzTcKVROLBnTgPlVV8c0PSKJmgAF6vMop6yJKw/YbhmSu9vhjxgao1dJZWQRg1Tu5VHqDeVJpJLFr2EqIp3q8f8OedA0dAO58WDf/sSRkXxfLtiTz2Zde8rQkOYjZUUOsKLIC2ywt+xAS8M0nWhOuQSr0NXwor4FoYverlOYtC3N8H2He4Ztsh9R41G9i7gaF1GijJVxEzrxDauliy67kj3qx3YhmB4pWX54UZn6o6f6ee9ALGXG7VxYq9zgeZWNaVIMRnkQkYSa1PBrveH06PUjlMhmw74pSIEVpgzdCUQcE6qIUal3vTJyDU3mBZ3jYzpiNFHSmYik64wiaCLD0rIHtPIVVYr9D2YJIa6heAQtZ0r9RBVrPJhXbQdlbdNQK8F6kmoDWsyLGRwPlghx5HB4eno6NM2HbLcY5gBgw4eHBvNqCZVph12iNe5NzBjVpFUR5cKGTCoOtWaGJiBVbhWDvbyrZaFLKnlkmnRgKX3vsK23fvRTQCZNg3qgQFW0FsZ+GxOkNQVNQ1OGisYN7f4i82u9Hh3HRWMxgZfEGABCUyBNu2hYQ4iU7PsMsx5i31AiPdgUNNpJIWktUMvNRShw3FITAoChnQaApsAmHCddLnsEKiZKt1goBY4TInxT8BzPu991WI9KO5wZtpiJ/nwp0xQ0fwWWDajLxJ7wax1ZrddNc30Hcn35/vFCZqBvuCm0OaS7CJcK9gSyWi1PE4cSgwn6G0omK86RUW/vQL8nHUngkUj/2KGB6OTIpDgzOZY69uQoiiSN/pkD0eSRET5dKs+Ei0opdVQVj42M5rKFQiIeb8pJeaS6qMVal1osaLmhpDAyykUz0550bEDaD0visf2TBXEiOkiScOzgVGo0O4KnmwM/VGy1Sl+71baa9ovl7dd6C4F0FwpznPgmjtOvpoD2FVuuX8ekGK/rUGElBUAxqkiCIij0ZKUjASKRF5teflsM7xAkpISms0y+enpKQiabSzEI6roUiSGe0SHHKhyUmlyXWy3Ma7UsY//0tlbQ/FpfG3g+P6YCoGOE/J1DSLXLYRt6pOQPjVet7lkJURjT019o4eRPJYdcBDXbMiuNMK+Cx7Cm6HnRdiuNKFxmXgUPVFXbs0gj6hZZV8Ghe6ZumKZ/KdCIwhr21ZhpQbNCDBU3pNKw/GzDq2BxYKUKUDOw49fLijjpWBm5KgoZ2sJdYyPGuogqhNUrtUaYVqly2WTLJoZuqAsysKdg1TWcT7XCr/UGZDXiD0xrYVWhW2BYkaoaLqQh05hCKy27ZayUxW6oNZSh46y4rSyrKyOMYXG1+agjpClQnVglGy4ZVRubu6FAmuEilYx7rtFaq+ji5mE8SwODmbqtBIOp4aQp5L5bW/HWKZvI58cyudQKwdFav/jfAabQVKttCGmec6oSgQwvipCJcJrKQA0Ahmd5UReiMYDY5jaDLXfdxkajQkTgY3xzuHIImuXWQua4tuap/rrxf2R1AzXPMv/xLhe+8328t636Y48HXgPHA6+2BwJgH9jNPgq+1NUx0tmxcTs2CN2xQD2EjaIFieei0ASqONBw27e2Xf39W8OPvPK1+afffWj2xK7wmbbNNc/z578Oupcf6Nd3sBtqXuvBztsz69gtD23iRBABIhD4KAeOgkdvz3ay2zo/P73Dfu5cRPrge9sGv2u/98yGx19960dg0zJRILCurfN4oG2X8fzkEw/f+klHxzuPBeZfgn+TL72ybZhwXx2aeP/l7d3j4t7S/Nkb8BcXt5z+xzNzpzo+/HkidzL+9htz3OtXLpj2D/SXpcOpyF+vf/PjH587dfr6r54/JT32ur5x3i1ePnXxX1u/vXHzlg9/2fGHh7u6f5355ON3kztfCH+ySdxzo3vgxOfmbube/N3bL46de+Tgc1fPWH8U4wcvl2+iB/rTPzyrzj379wfDXR+9sSN9+oM3M+99RXrhxJ/YIkklezZci/25/VZu8xcuufjZFy1n/p8fbZ25/K1bJ+cmpHce/PKFz752KXBhy0n4lye+cyX+229IL53Z8fjZPdfeL3XfMK5Hvg+e/szOn135zdWf7p7fzX1xIZb/BrhV7NE4IQAA";

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
