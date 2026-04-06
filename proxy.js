// ===============================
// CONFIG
// ===============================
const MIN_ROI = 0.15; // 15% minimum ROI
const MAX_PRICE = 1000;
const MIN_PRICE = 10;

// ===============================
// MAIN PIPELINE
// ===============================
async function findDeals(listings) {
  const valid = listings.filter(l => isValidAuto(l.title));

  const deals = [];

  for (const item of valid) {
    const grade = detectGrade(item.title);

    const comps = await getComps(item.title);

    const filteredComps = comps
      .filter(c => gradeMatches(c.title, grade))
      .map(c => c.price)
      .filter(p => p > 0);

    if (filteredComps.length < 3) continue;

    const marketPrice = median(filteredComps);

    if (!marketPrice) continue;

    if (item.price < MIN_PRICE || item.price > MAX_PRICE) continue;

    const roi = (marketPrice - item.price) / item.price;

    if (roi < MIN_ROI) continue;

    const startOffer = round(marketPrice * 0.65);
    const maxOffer = round(marketPrice * 0.80);
    const profit = round(marketPrice - item.price);

    deals.push({
      title: item.title,
      price: item.price,
      marketPrice,
      roi: round(roi * 100) / 100,
      url: item.url,
      offer: {
        startOffer,
        maxOffer,
        profit
      }
    });
  }

  return {
    count: deals.length,
    deals: deals.sort((a, b) => b.offer.profit - a.offer.profit)
  };
}

// ===============================
// FILTERS
// ===============================
function isValidAuto(title) {
  const t = title.toLowerCase();

  const banned = [
    "signed",
    "autographed",
    "psa/dna",
    "dna auto",
    "in person",
    "ip auto",
    "custom",
    "leaf",
    "paper",
    "sticker auto"
  ];

  if (banned.some(b => t.includes(b))) return false;

  return (
    t.includes("bowman chrome") &&
    t.includes("1st") &&
    t.includes("auto")
  );
}

// ===============================
// GRADE HANDLING
// ===============================
function detectGrade(title) {
  const t = title.toLowerCase();

  if (t.includes("psa 10")) return "psa10";
  if (t.includes("psa 9")) return "psa9";
  if (t.includes("bgs 9.5")) return "bgs95";
  if (t.includes("sgc 10")) return "sgc10";

  return "raw";
}

function gradeMatches(compTitle, targetGrade) {
  const t = compTitle.toLowerCase();

  if (targetGrade === "raw") {
    return (
      !t.includes("psa") &&
      !t.includes("bgs") &&
      !t.includes("sgc")
    );
  }

  if (targetGrade === "psa10") return t.includes("psa 10");
  if (targetGrade === "psa9") return t.includes("psa 9");
  if (targetGrade === "bgs95") return t.includes("bgs 9.5");
  if (targetGrade === "sgc10") return t.includes("sgc 10");

  return false;
}

// ===============================
// HELPERS
// ===============================
function median(arr) {
  if (!arr.length) return null;

  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round(num) {
  return Math.round(num * 100) / 100;
}

// ===============================
// MOCK: REPLACE WITH REAL EBAY SOLD API
// ===============================
async function getComps(title) {
  return [];
}

// ===============================
// ITERATIVE SEARCH EXPANSION
// ===============================
async function runSearch(searchSets) {
  let allDeals = [];

  for (const listings of searchSets) {
    const result = await findDeals(listings);

    if (result.count > 0) {
      allDeals = allDeals.concat(result.deals);
    }
  }

  // Deduplicate by title
  const unique = {};
  for (const d of allDeals) {
    unique[d.title] = d;
  }

  const finalDeals = Object.values(unique)
    .sort((a, b) => b.offer.profit - a.offer.profit);

  return {
    count: finalDeals.length,
    deals: finalDeals
  };
}
