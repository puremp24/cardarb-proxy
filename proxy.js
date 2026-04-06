const express = require("express");
const cors = require("cors");
const fetch = (...a)=>import("node-fetch").then(({default:f})=>f(...a));

const app = express();
app.use(cors());

const PORT = process.env.PORT || 8080;

// 🔑 SET THESE IN YOUR HOST (Railway, etc.)
const CLIENT_ID = process.env.CLIENT_ID || "";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "";

let cachedToken = null;
let tokenExpiry = 0;

// ── GET EBAY TOKEN ─────────────────────────────────────────
async function getToken(){
  if(cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token",{
    method:"POST",
    headers:{
      "Authorization":`Basic ${creds}`,
      "Content-Type":"application/x-www-form-urlencoded"
    },
    body:new URLSearchParams({
      grant_type:"refresh_token",
      refresh_token:REFRESH_TOKEN
    })
  });

  const data = await res.json();

  if(!res.ok){
    throw new Error("Token error: " + JSON.stringify(data));
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 120) * 1000;

  return cachedToken;
}

// ── SEARCH EBAY ─────────────────
