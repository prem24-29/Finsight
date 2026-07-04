const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static assets from the current directory
app.use(express.static(__dirname));

// Configuration keys matching CONFIG in index.html
const CONFIG = {
  NEWS_API_KEY: process.env.NEWS_API_KEY || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || ''
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ══════════════════════════════════════════
// YAHOO FINANCE PROXY
// ══════════════════════════════════════════
app.get('/api/chart', async (req, res) => {
  const { symbol, range = '1d', interval = '1d' } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: 'Symbol parameter is required' });
  }

  const hosts = ['query1', 'query2'];
  for (const host of hosts) {
    const yahooUrl = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&region=IN&lang=en-IN`;
    try {
      const response = await axios.get(yahooUrl, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 8000
      });
      if (response.data?.chart?.result?.[0]) {
        return res.json(response.data.chart.result[0]);
      }
    } catch (e) {
      console.warn(`Yahoo fetch failed on host ${host}: ${e.message}`);
    }
  }
  res.status(502).json({ error: 'Failed to fetch chart data from Yahoo Finance' });
});

// ══════════════════════════════════════════
// LIVEMINT RSS FEED PARSER
// ══════════════════════════════════════════
const MINT_FEEDS = {
  latest: 'https://www.livemint.com/rss/markets',
  business: 'https://www.livemint.com/rss/companies',
  economy: 'https://www.livemint.com/rss/opinion',
  markets: 'https://www.livemint.com/rss/markets',
  results: 'https://www.livemint.com/rss/companies',
  buzzing: 'https://www.livemint.com/rss/markets',
  ipo: 'https://www.livemint.com/rss/markets',
  mf: 'https://www.livemint.com/rss/opinion',
};

function parseMintRSS(xmlText) {
  const articles = [];
  // Simple regex-based XML item extractor (robust, fast, no external XML library needed)
  const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g) || [];
  for (const item of itemMatches) {
    const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || item.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = item.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/) || item.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = item.match(/<pubDate><!\[CDATA\[([\s\S]*?)\]\]><\/pubDate>/) || item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || item.match(/<description>([\s\S]*?)<\/description>/);

    const title = titleMatch ? titleMatch[1].trim() : '';
    const url = linkMatch ? linkMatch[1].trim() : '';
    const pubDateRaw = pubDateMatch ? pubDateMatch[1].trim() : '';
    const descRaw = descMatch ? descMatch[1].trim() : '';
    const description = descRaw.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

    let publishedAt = new Date().toISOString();
    try {
      if (pubDateRaw) publishedAt = new Date(pubDateRaw).toISOString();
    } catch {}

    if (title && url) {
      articles.push({
        title,
        url,
        publishedAt,
        description,
        source: { name: 'Livemint' }
      });
    }
  }
  return articles;
}

async function fetchMintNews(query, n = 20) {
  const q = query.toLowerCase();
  const feedKeys = new Set();

  // Route queries to correct Livemint RSS feeds
  if (/merger|acquisition|deal|m&a|buyout/.test(q)) {
    feedKeys.add('business');
    feedKeys.add('latest');
  } else if (/ipo|listing|initial public offering/.test(q)) {
    feedKeys.add('latest');
    feedKeys.add('business');
  } else if (/private equity|venture capital|startup|funding|seed/.test(q)) {
    feedKeys.add('business');
    feedKeys.add('latest');
  } else if (/rbi|fed|rate|inflation|gdp|budget|policy|reserve/.test(q)) {
    feedKeys.add('economy');
  } else if (/nifty|sensex|nse|bse|index|shares/.test(q)) {
    feedKeys.add('markets');
    feedKeys.add('latest');
  } else if (/earnings|result|profit|revenue|quarterly/.test(q)) {
    feedKeys.add('business');
  } else {
    // Default fallback feed
    feedKeys.add('latest');
    feedKeys.add('business');
    feedKeys.add('economy');
  }

  const keys = Array.from(feedKeys);
  const feedResults = await Promise.all(keys.map(async key => {
    const url = MINT_FEEDS[key];
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 6000
      });
      return parseMintRSS(res.data);
    } catch (e) {
      console.warn(`Livemint feed ${key} fetch failed: ${e.message}`);
      return [];
    }
  }));

  const merged = feedResults.flat();
  const seen = new Set();
  const deduped = merged.filter(a => {
    if (seen.has(a.title)) return false;
    seen.add(a.title);
    return true;
  });

  // Filter articles based on keywords for the segment to make it fully dynamic and divided!
  let filtered = deduped;
  
  if (/merger|acquisition|deal|m&a|buyout/.test(q)) {
    filtered = deduped.filter(a => /merger|acquisition|deal|buyout|stake|m&a|acquire|purchase/i.test(a.title + " " + a.description));
  } else if (/ipo|listing|initial public offering/.test(q)) {
    filtered = deduped.filter(a => /ipo|listing|debut|gmp|subscription|allotment|public offer/i.test(a.title + " " + a.description));
  } else if (/private equity|venture capital|startup|funding|seed/.test(q)) {
    filtered = deduped.filter(a => /funding|startup|pe\/vc|raise|venture|capital|seed|round|investment/i.test(a.title + " " + a.description));
  } else if (/rbi|fed|rate|inflation|gdp|budget|policy|reserve/.test(q)) {
    filtered = deduped.filter(a => /rbi|fed|rate|inflation|cpi|gdp|growth|policy|reserve|fiscal|deficit|tax/i.test(a.title + " " + a.description));
  } else if (/nifty|sensex|nse|bse|index|shares/.test(q)) {
    filtered = deduped.filter(a => /nifty|sensex|stock|shares|market|bull|bear|trade|nse|bse|index|points/i.test(a.title + " " + a.description));
  } else if (/earnings|result|profit|revenue|quarterly/.test(q)) {
    filtered = deduped.filter(a => /earnings|profit|revenue|loss|quarter|q1|q2|q3|q4|income|ebitda/i.test(a.title + " " + a.description));
  }

  // If filter returned too few results, fallback to the original deduped list to avoid empty slots
  if (filtered.length < 3) {
    filtered = deduped;
  }

  filtered.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return filtered.slice(0, n);
}

// ══════════════════════════════════════════
// GENERAL NEWS ENDPOINT
// ══════════════════════════════════════════
app.get('/api/news', async (req, res) => {
  const { query = 'finance', pageSize = 20, country = 'IN' } = req.query;

  // Prefer Livemint for India
  if (country === 'IN') {
    try {
      const mcArticles = await fetchMintNews(query, parseInt(pageSize));
      if (mcArticles.length > 0) {
        return res.json(mcArticles);
      }
    } catch (e) {
      console.warn(`Livemint parser failed, falling back: ${e.message}`);
    }
  }

  // Fallback to NewsAPI
  const newsApiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=${pageSize}&apiKey=${CONFIG.NEWS_API_KEY}`;
  try {
    const response = await axios.get(newsApiUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000
    });
    const articles = (response.data.articles || [])
      .filter(a => a.title && a.title !== '[Removed]' && a.url)
      .map(a => ({
        title: a.title,
        url: a.url,
        publishedAt: a.publishedAt || new Date().toISOString(),
        description: a.description || '',
        source: { name: a.source?.name || 'News' }
      }));
    return res.json(articles);
  } catch (e) {
    console.error(`NewsAPI fetch failed: ${e.message}`);
    return res.status(502).json({ error: 'Failed to fetch financial news' });
  }
});

// ══════════════════════════════════════════
// ANTHROPIC CLAUDE PROXY
// ══════════════════════════════════════════
app.post('/api/claude', async (req, res) => {
  const { system, messages, model = 'claude-3-5-sonnet-20241022', max_tokens = 2000 } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages parameter is required and must be an array' });
  }

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model,
      max_tokens,
      system,
      messages
    }, {
      headers: {
        'x-api-key': CONFIG.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      timeout: 25000
    });
    
    if (response.data?.content?.[0]?.text) {
      return res.json({ text: response.data.content[0].text });
    }
    res.status(500).json({ error: 'Invalid response from Anthropic Claude API' });
  } catch (e) {
    console.error(`Claude API request failed: ${e.message}`);
    const errorDetails = e.response?.data || e.message;
    res.status(502).json({ error: 'Claude API request failed', details: errorDetails });
  }
});

// Fallback to serve index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`FinSight Pro Backend Server is running!`);
  console.log(`Local Access: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
