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
    itemId:       i.itemId,
    title:        i.title,
    price:        parseFloat(i.price?.value || "0"),
    shippingCost: parseFloat(i.shippingOptions?.[0]?.shippingCost?.value || "0"),
    freeShipping: i.shippingOptions?.[0]?.shippingCostType === "FREE",
    url:          i.itemWebUrl,
    seller:       i.seller?.username,
    image:        i.image?.imageUrl || null,
    hasBestOffer: (i.buyingOptions || []).includes("BEST_OFFER"),
  })).filter(i => i.price > 0 && (!maxPrice || i.price <= maxPrice));
}

// ── Best Offer search via Finding API ────────────────────────────────────────
async function searchBestOffer(q, maxPrice) {
  const params = new URLSearchParams();
  params.set("OPERATION-NAME",       "findItemsAdvanced");
  params.set("SERVICE-VERSION",      "1.13.0");
  params.set("SECURITY-APPNAME",     CLIENT_ID);
  params.set("RESPONSE-DATA-FORMAT", "JSON");
  params.set("keywords",             q);
  params.set("categoryId",           "212");
  params.set("paginationInput.entriesPerPage", "20");
  params.set("outputSelector(0)",    "SellerInfo");
  params.set("outputSelector(1)",    "GalleryInfo");
  // BIN + Best Offer
  params.set("itemFilter(0).name",  "ListingType");
  params.set("itemFilter(0).value(0)", "FixedPrice");
  params.set("itemFilter(0).value(1)", "AuctionWithBIN");
  // Best Offer only
  params.set("itemFilter(1).name",  "BestOfferOnly");
  params.set("itemFilter(1).value", "true");
  if (maxPrice) {
    params.set("itemFilter(2).name",  "MaxPrice");
    params.set("itemFilter(2).value", String(maxPrice));
  }
  params.set("sortOrder", "PricePlusShippingLowest");

  const res  = await fetch(`${FINDING_BASE}?${params}`);
  const json = await res.json();
  const items = json?.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item || [];

  return items.map(i => ({
    itemId:      i.itemId?.[0],
    title:       i.title?.[0],
    price:       parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.["__value__"] || "0"),
    shippingCost:parseFloat(i.shippingInfo?.[0]?.shippingServiceCost?.[0]?.["__value__"] || "0"),
    freeShipping:(i.shippingInfo?.[0]?.shippingServiceCost?.[0]?.["__value__"] || "0") === "0",
    url:         i.viewItemURL?.[0],
    seller:      i.sellerInfo?.[0]?.sellerUserName?.[0],
    image:       i.galleryURL?.[0],
    hasBestOffer:true,
    isBestOffer: true,
  })).filter(i => i.price > 0 && (!maxPrice || i.price <= maxPrice));
}

// ── Calculate offer prices ────────────────────────────────────────────────────
// Returns: lowestOffer (aggressive, ~30% below ask, still worth trying)
//          breakEvenOffer (exact price to hit 10% ROI after all fees)
//          targetOffer (price to hit 20% ROI — sweet spot)
function calcOffers(askPrice, marketPrice, shipping) {
  const FVF      = 0.1325;
  const ORDER    = 0.30;
  const sellShip = marketPrice > 50 ? 10 : 5;
  const netSale  = marketPrice - (marketPrice * FVF) - ORDER - sellShip;
  const buyShip  = shipping || 5;

  // Work backwards from desired ROI to find max offer price
  // ROI = (netSale - totalCost) / totalCost  →  totalCost = netSale / (1 + ROI)
  const maxForROI10  = (netSale / 1.10) - buyShip;   // offer to get 10% ROI
  const maxForROI20  = (netSale / 1.20) - buyShip;   // offer to get 20% ROI
  const maxForROI30  = (netSale / 1.30) - buyShip;   // offer to get 30% ROI
  const aggressive   = askPrice * 0.60;               // 40% below ask — floor offer
  const lowestOffer  = Math.max(Math.floor(Math.min(aggressive, maxForROI30)), 1);
  const targetOffer  = Math.floor(maxForROI20);        // aim for 20% ROI
  const maxOffer     = Math.floor(maxForROI10);        // max to still hit 10% ROI

  // ROI at each offer level
  const roiAt = (offer) => {
    const cost   = offer + buyShip;
    const profit = netSale - cost;
    return profit / cost;
  };

  return {
    lowestOffer:  Math.max(lowestOffer, 1),
    targetOffer:  Math.max(targetOffer, 1),
    maxOffer:     Math.max(maxOffer, 1),
    roiAtLowest:  roiAt(lowestOffer),
    roiAtTarget:  roiAt(targetOffer),
    roiAtMax:     roiAt(maxOffer),
    netSale,
    sellShip,
  };
}

// ── Auction search via Finding API — ending within 24hrs ─────────────────────
const FINDING_BASE = "https://svcs.ebay.com/services/search/FindingService/v1";
async function searchAuctions(q, maxPrice) {
  const params = new URLSearchParams();
  params.set("OPERATION-NAME",       "findItemsAdvanced");
  params.set("SERVICE-VERSION",      "1.13.0");
  params.set("SECURITY-APPNAME",     CLIENT_ID);
  params.set("RESPONSE-DATA-FORMAT", "JSON");
  params.set("keywords",             q);
  params.set("categoryId",           "212");
  params.set("paginationInput.entriesPerPage", "20");
  params.set("outputSelector(0)",    "SellerInfo");
  params.set("outputSelector(1)",    "GalleryInfo");
  // Auction only
  params.set("itemFilter(0).name",  "ListingType");
  params.set("itemFilter(0).value", "Auction");
  // Ending within 24 hours
  params.set("itemFilter(1).name",  "EndTimeTo");
  params.set("itemFilter(1).value", new Date(Date.now() + 24*60*60*1000).toISOString());
  // Max current bid price
  if (maxPrice) {
    params.set("itemFilter(2).name",       "MaxPrice");
    params.set("itemFilter(2).value",      String(maxPrice));
    params.set("itemFilter(2).paramName",  "Currency");
    params.set("itemFilter(2).paramValue", "USD");
  }
  // Sort by ending soonest
  params.set("sortOrder", "EndTimeSoonest");

  const res  = await fetch(`${FINDING_BASE}?${params}`);
  const json = await res.json();
  const items = json?.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item || [];

  const now = Date.now();
  return items.map(i => {
    const endTime    = new Date(i.listingInfo?.[0]?.endTime?.[0] || 0).getTime();
    const hoursLeft  = Math.max(0, (endTime - now) / 3600000);
    const currentBid = parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.["__value__"] || "0");
    const shipping   = parseFloat(i.shippingInfo?.[0]?.shippingServiceCost?.[0]?.["__value__"] || "0");
    return {
      itemId:      i.itemId?.[0],
      title:       i.title?.[0],
      price:       currentBid,        // current bid
      currentBid,
      shipping,
      freeShipping: shipping === 0,
      shippingCost: shipping,
      endTime:     new Date(endTime).toISOString(),
      hoursLeft:   Math.round(hoursLeft * 10) / 10,
      url:         i.viewItemURL?.[0],
      seller:      i.sellerInfo?.[0]?.sellerUserName?.[0],
      image:       i.galleryURL?.[0],
      isAuction:   true,
    };
  }).filter(i => i.currentBid > 0 && i.hoursLeft <= 24 && i.hoursLeft > 0);
}

// ── Strict title filter ───────────────────────────────────────────────────────
function strictFilter(items, keywords, maxPrice) {
  const stop    = new Set(["the","and","for","gem","mint","qty","lot","pack","break","card","cards","new","other","1st","2nd","3rd","auto","psa","bgs","sgc","10","graded"]);
  const badWords = ["generation","refractor","insert","parallel","sapphire","aqua","pink","wave","disco","hyper","laser","mojo","speckle","shimmer","cracked","ice","emergent","freshman","phenoms","choice","stained","glass","flux","illusions","noir","flawless","gold","silver","orange","purple","green","red","blue","gold","numbered","1/1"];
  const searchHasBad = badWords.filter(w => keywords.toLowerCase().includes(w));

  // Extract meaningful terms — player name words and set name, skip year/numbers
  const allTerms = keywords.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  // Must-match: player name (first 2 words of meaningful terms)
  // Should-match: remaining set terms (require 60%)
  const playerTerms = allTerms.slice(0, 2);
  const setTerms    = allTerms.slice(2);

  return items.filter(i => {
    if (i.price <= 0) return false;
    if (maxPrice && i.price > maxPrice) return false;
    const t = i.title.toLowerCase();

    // Player name terms must ALL match
    if (!playerTerms.every(w => t.includes(w))) return false;

    // Set terms: require 60% match (flexible for title variations)
    if (setTerms.length > 0) {
      const setMatches = setTerms.filter(w => t.includes(w)).length;
      if (setMatches < Math.ceil(setTerms.length * 0.6)) return false;
    }

    // Reject bad card type words not in original search
    const titleBad = badWords.filter(w => t.includes(w) && !searchHasBad.includes(w));
    if (titleBad.length > 0) return false;

    return true;
  });
}

// ── Claude vision: compare listing image to comp images ───────────────────────
async function imagesMatch(listingImageUrl, compImageUrl) {
  try {
    // Fetch both images as base64
    const [r1, r2] = await Promise.all([
      fetch(listingImageUrl),
      fetch(compImageUrl),
    ]);
    if (!r1.ok || !r2.ok) return null;

    const [b1, b2] = await Promise.all([
      r1.arrayBuffer().then(b => Buffer.from(b).toString("base64")),
      r2.arrayBuffer().then(b => Buffer.from(b).toString("base64")),
    ]);

    const mt1 = r1.headers.get("content-type") || "image/jpeg";
    const mt2 = r2.headers.get("content-type") || "image/jpeg";

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "x-api-key":     process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 64,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mt1, data: b1 } },
            { type: "image", source: { type: "base64", media_type: mt2, data: b2 } },
            { type: "text",  text: "Are these two sports cards the same card (same year, same set, same player, same card number, same grade)? Reply with only YES or NO." },
          ],
        }],
      }),
    });

    const data = await resp.json();
    const answer = (data.content?.[0]?.text || "").trim().toUpperCase();
    return answer.startsWith("YES");
  } catch(e) {
    console.log("Vision compare failed:", e.message);
    return null; // null = unknown, don't filter
  }
}
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
    console.log(`${binQ.slice(0,40)}: ${rawListings.length} raw → ${listings.length} filtered listings`);

    // 2. Try 130point for real sold comps first
    let compItems  = await getSoldComps(compQ);
    let compSource = "130point";

    // 3. Fall back to Browse API if not enough results
    if (compItems.length < 3) {
      const compRaw = await browse(compQ, null, 50);
      compItems  = strictFilter(compRaw, compQ, null).map(i => i.price).filter(p => p > 0).sort((a,b)=>a-b);
      compSource = "browse_active";
    }

    // 4. Market price = median
    let marketPrice = null;
    if (compItems.length >= 2) {
      marketPrice = compItems[Math.floor(compItems.length / 2)];
    }

    // 5. Price-sanity filter — reject listings >80% below market median
    const priceFiltered = marketPrice
      ? listings.filter(l => l.price >= marketPrice * 0.20)
      : listings;

    // 6. Get comp images for visual reference
    const compRawFull  = await browse(compQ, null, 10);
    const compWithImages = strictFilter(compRawFull, compQ, null)
      .filter(i => i.image)
      .slice(0, 4)
      .map(i => ({ title: i.title, price: i.price, url: i.url, image: i.image }));

    const refCompImage = compWithImages[0]?.image || null;

    // 7. Vision-validate each listing image vs reference comp image
    const validatedListings = [];
    for (const lst of priceFiltered) {
      if (!lst.image || !refCompImage) {
        lst.imageMatch = null;
        validatedListings.push(lst);
      } else {
        const match = await imagesMatch(lst.image, refCompImage);
        if (match !== false) {
          lst.imageMatch = match;
          validatedListings.push(lst);
        } else {
          console.log("Vision filtered:", lst.title.slice(0, 40));
        }
      }
    }

    res.json({ listings: validatedListings, marketPrice, compCount: compItems.length, compSample: compItems.slice(0,8), compWithImages, compSource });
  } catch(e) {
    console.error("/scan:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── /scan-auction — auctions ending within 24hrs ─────────────────────────────
app.get("/scan-auction", async (req, res) => {
  const { binQ, soldQ, maxPrice } = req.query;
  if (!binQ) return res.status(400).json({ error: "binQ required" });
  const mp    = parseFloat(maxPrice) || 500;
  const compQ = soldQ || binQ;

  try {
    // 1. Get auctions ending within 24 hours
    const rawAuctions = await searchAuctions(binQ, mp);
    const auctions    = strictFilter(rawAuctions, binQ, mp);
    console.log(`AUCTION ${binQ.slice(0,35)}: ${rawAuctions.length} raw → ${auctions.length} filtered`);

    // 2. Get market price (same as BIN scan)
    let compItems  = await getSoldComps(compQ);
    let compSource = "130point";
    if (compItems.length < 3) {
      const compRaw = await browse(compQ, null, 50);
      compItems  = strictFilter(compRaw, compQ, null).map(i => i.price).filter(p => p > 0).sort((a,b)=>a-b);
      compSource = "browse_active";
    }
    let marketPrice = null;
    if (compItems.length >= 2) {
      marketPrice = compItems[Math.floor(compItems.length / 2)];
    }

    // 3. Price sanity filter
    const priceFiltered = marketPrice
      ? auctions.filter(a => a.currentBid >= marketPrice * 0.10) // auctions can be very low
      : auctions;

    // 4. Comp images
    const compRawFull    = await browse(compQ, null, 10);
    const compWithImages = strictFilter(compRawFull, compQ, null)
      .filter(i => i.image).slice(0, 4)
      .map(i => ({ title: i.title, price: i.price, url: i.url, image: i.image }));
    const refCompImage = compWithImages[0]?.image || null;

    // 5. Vision validate
    const validated = [];
    for (const lst of priceFiltered) {
      if (!lst.image || !refCompImage) {
        lst.imageMatch = null; validated.push(lst);
      } else {
        const match = await imagesMatch(lst.image, refCompImage);
        if (match !== false) { lst.imageMatch = match; validated.push(lst); }
        else console.log("Auction vision filtered:", lst.title.slice(0,40));
      }
    }

    res.json({ auctions: validated, marketPrice, compCount: compItems.length, compSample: compItems.slice(0,8), compWithImages, compSource });
  } catch(e) {
    console.error("/scan-auction:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── /scan-offer — Best Offer listings with suggested offer prices ─────────────
app.get("/scan-offer", async (req, res) => {
  const { binQ, soldQ, maxPrice } = req.query;
  if (!binQ) return res.status(400).json({ error: "binQ required" });
  const mp    = parseFloat(maxPrice) || 500;
  const compQ = soldQ || binQ;

  try {
    // 1. Get Best Offer listings (search up to 2x maxPrice since we'll offer less)
    const rawOffers = await searchBestOffer(binQ, mp * 2);
    const offers    = strictFilter(rawOffers, binQ, mp * 2);
    console.log(`OFFER ${binQ.slice(0,35)}: ${rawOffers.length} raw → ${offers.length} filtered`);

    // 2. Get market price
    let compItems  = await getSoldComps(compQ);
    let compSource = "130point";
    if (compItems.length < 3) {
      const compRaw = await browse(compQ, null, 50);
      compItems  = strictFilter(compRaw, compQ, null).map(i => i.price).filter(p => p > 0).sort((a,b)=>a-b);
      compSource = "browse_active";
    }
    let marketPrice = null;
    if (compItems.length >= 2) {
      marketPrice = compItems[Math.floor(compItems.length / 2)];
    }

    if (!marketPrice) return res.json({ offers: [], marketPrice: null, compCount: compItems.length });

    // 3. Calculate offer prices for each listing
    const result = offers
      .filter(lst => lst.price > marketPrice * 0.3) // skip listings already way below market (probably wrong card)
      .map(lst => {
        const shipping = lst.freeShipping ? 0 : (lst.shippingCost || 5);
        const offerCalc = calcOffers(lst.price, marketPrice, shipping);
        return {
          ...lst,
          marketPrice,
          shipping,
          ...offerCalc,
        };
      })
      .filter(lst => lst.maxOffer > 0 && lst.maxOffer < lst.price) // only show if our max offer < ask price
      .sort((a, b) => b.roiAtTarget - a.roiAtTarget);

    // 4. Get comp images
    const compRawFull    = await browse(compQ, null, 10);
    const compWithImages = strictFilter(compRawFull, compQ, null)
      .filter(i => i.image).slice(0, 3)
      .map(i => ({ title: i.title, price: i.price, url: i.url, image: i.image }));

    res.json({ offers: result, marketPrice, compCount: compItems.length, compSample: compItems.slice(0,6), compWithImages, compSource });
  } catch(e) {
    console.error("/scan-offer:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/ping", (_, res) => res.json({ ok: true }));
app.get("/",    (_, res) => res.json({ service: "CARDARB proxy", status: "running" }));
app.listen(PORT, () => console.log(`CARDARB proxy on port ${PORT}`));
