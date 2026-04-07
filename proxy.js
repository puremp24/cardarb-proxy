const express = require('express')
const cors = require('cors')
const fetch = require('node-fetch')

const app = express()
app.use(cors());

/* =========================
   CONFIG
========================= */
const EBAY_APP_ID = process.env.EBAY_APP_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/* =========================
   HEALTH
========================= */
app.get("/ping", (req, res) => res.send("ok"));

/* =========================
   TIMEOUT FETCH
========================= */
async function fetchWithTimeout(url, options = {}, timeout = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

/* =========================
   IMAGE BASE64
========================= */
async function toBase64(url) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res) return null;
    const buf = await res.arrayBuffer();
    return Buffer.from(buf).toString("base64");
  } catch {
    return null;
  }
}

/* =========================
   VISION (SAFE + FAST)
========================= */
const cache = new Map();

async function imagesMatch(img1Url, img2Url) {
  try {
    if (!img1Url || !img2Url) return null;

    const key = img1Url + "|" + img2Url;
    if (cache.has(key)) return cache.get(key);

    const [img1, img2] = await Promise.all([
      toBase64(img1Url),
      toBase64(img2Url),
    ]);

    if (!img1 || !img2) return null;

    const resp = await fetchWithTimeout(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 50,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Are these the same trading card? Answer YES or NO only.",
                },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: img1,
                  },
                },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: img2,
                  },
                },
              ],
            },
          ],
        }),
      },
      3000 // hard timeout
    );

    if (!resp) return null;

    const data = await resp.json();
    const text = data?.content?.[0]?.text || "";
    const match = text.toUpperCase().includes("YES");

    cache.set(key, match);
    return match;
  } catch {
    return null;
  }
}

/* =========================
   EBAY SEARCH
========================= */
async function searchEbay(query) {
  const url = `https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findItemsByKeywords&SECURITY-APPNAME=${EBAY_APP_ID}&RESPONSE-DATA-FORMAT=JSON&keywords=${encodeURIComponent(
    query
  )}&paginationInput.entriesPerPage=20`;

  const res = await fetchWithTimeout(url);
  if (!res) return [];

  const data = await res.json();

  try {
    return (
      data.findItemsByKeywordsResponse[0].searchResult[0].item || []
    ).map((i) => ({
      title: i.title[0],
      price: parseFloat(i.sellingStatus[0].currentPrice[0].__value__),
      url: i.viewItemURL[0],
      image: i.galleryURL?.[0],
    }));
  } catch {
    return [];
  }
}

/* =========================
   MARKET PRICE
========================= */
function avgPrice(list) {
  if (!list.length) return null;
  const p = list.map((x) => x.price).filter(Boolean);
  return p.reduce((a, b) => a + b, 0) / p.length;
}

/* =========================
   SCAN PLAYER
========================= */
async function scanPlayer(player) {
  const listings = await searchEbay(player);
  if (!listings.length) return { player, deals: [] };

  const market = avgPrice(listings);

  const results = await Promise.all(
    listings.map(async (l) => {
      // only validate potential deals
      if (market && l.price < market * 0.75) {
        const ok = await imagesMatch(l.image, listings[0].image);
        if (ok === false) return null;
      }

      const roi = market
        ? ((market - l.price) / l.price) * 100
        : 0;

      if (roi < 15) return null;

      return {
        title: l.title,
        price: l.price,
        marketPrice: market,
        roi: roi.toFixed(1),
        url: l.url,
      };
    })
  );

  return {
    player,
    deals: results.filter(Boolean),
  };
}

/* =========================
   SCAN ROUTE (FIXED)
========================= */
app.get("/scan", async (req, res) => {
  const players = [
    "Shohei Ohtani auto",
    "CJ Stroud auto",
    "Victor Wembanyama auto",
    "Elly De La Cruz auto",
    "Aaron Judge auto",
  ];

  try {
    // 🚀 ONLY RUN FIRST PLAYER (prevents UI freeze)
    const result = await scanPlayer(players[0]);

    return res.json({
      count: result.deals.length,
      deals: result.deals,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "scan failed" });
  }
});

/* =========================
   START
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Proxy running on port " + PORT);
});
