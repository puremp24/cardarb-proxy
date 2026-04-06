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
  })).filter(i => i.price > 0 && (!maxPrice || i.price <= maxPrice));
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

app.get("/ping", (_, res) => res.json({ ok: true }));
app.get("/",    (_, res) => res.json({ service: "CARDARB proxy", status: "running" }));
app.listen(PORT, () => console.log(`CARDARB proxy on port ${PORT}`));
