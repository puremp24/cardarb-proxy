const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 8080;

// ✅ Use built-in fetch (Node 18+)
const fetch = global.fetch;

// 🔑 ONLY THESE TWO ARE NEEDED NOW
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process
