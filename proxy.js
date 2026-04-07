const express = require("express");
const fetch = require("node-fetch");
const app = express();

const PORT = process.env.PORT || 3000;

// 🔥 CONFIG
const EBAY_FVF = 0.1325;
const ORDER_FEE = 0.30;
const MIN_ROI = 0.15;

// 🔥 HIGH LIQUIDITY SEARCHES (NO BIAS)
const SEARCH_TERMS = [
"psa 10 auto",
"rookie auto psa 10",
"topps chrome auto",
"bowman chrome auto",
"baseball auto psa",
"rc auto psa",
"auto baseball card psa 10",
"topps auto baseball",
"bowman auto baseball",
"mlb auto psa 10"
];

// 🔥 ROI CALC
function calcROI(salePrice, buyPrice){
const fees = salePrice * EBAY_FVF + ORDER_FEE;
const shipping = salePrice > 50 ? 10 : 5;
const net = salePrice - fees - shipping;
return (net - buyPrice) / buyPrice;
}

// 🔥 OFFER ENGINE
function buildOffer(price, market){
return {
startOffer: +(market * 0.6).toFixed(2),
maxOffer: +(market * 0.9).toFixed(2),
profit: +(market - price).toFixed(2)
};
}

// 🔥 SCRAPE EBAY
async function searchEbay(query){

const url = "https://api.allorigins.win/raw?url=https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1";

const res = await fetch(url);
const html = await res.text();

const prices = [...html.matchAll(/$([0-9]+.[0-9]+)/g)]
.map(m => parseFloat(m[1]))
.filter(p => p > 10 && p < 5000);

return prices.slice(0, 15).map(p => ({
title: query,
price: p,
url: "https://www.ebay.com"
}));
}

// 🔥 CORE ENGINE
async function findDeals(){

let deals = [];

for(const term of SEARCH_TERMS){

const results = await searchEbay(term);

for(const item of results){

  // simulate spread (replace with real comps later)
  const marketPrice = item.price * (1.3 + Math.random() * 0.4);

  const roi = calcROI(marketPrice, item.price);

  if(roi >= MIN_ROI){

    deals.push({
      title: item.title,
      price: item.price,
      marketPrice: +marketPrice.toFixed(2),
      url: item.url,
      offer: buildOffer(item.price, marketPrice)
    });

  }
}

}

// 🔥 dedupe
const seen = new Set();
const unique = [];

for(const d of deals){
const key = d.title + d.price;
if(!seen.has(key)){
seen.add(key);
unique.push(d);
}
}

// 🔥 sort = best money first
unique.sort((a,b)=> b.offer.profit - a.offer.profit);

return unique.slice(0, 40);
}

// 🔥 ROUTE
app.get("/deals", async (req,res)=>{
try{
const deals = await findDeals();

res.json({
  count: deals.length,
  deals
});

}catch(err){
console.error(err);
res.status(500).json({error:"failed"});
}
});

app.get("/", (req,res)=> res.send("MONEY ENGINE LIVE"));

app.listen(PORT, ()=> console.log("Server running on " + PORT));
