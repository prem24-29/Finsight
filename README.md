# 📈 FinSight Pro — Multi-Market Intelligence Dashboard

> **A real-time financial intelligence aggregator and market dashboard powered by Node.js, Express, and LLM news summaries.**

---

## 🔍 Overview
FinSight Pro consolidates market intelligence by combining real-time security tracking, parsed financial news feeds, and automated artificial intelligence analysis. It is designed to help analysts quickly screen headlines and visualize market trends from a single dashboard.

### 🌟 Key Features
*   📊 **Real-Time Charting**: Ingests and renders live price and volume data using Yahoo Finance API proxies.
*   📰 **Custom RSS Ingestion**: Implements a high-performance, regex-based XML parser to ingest feeds from major publications like *Livemint* without external XML parsing library overhead.
*   🤖 **AI News Summarization**: Integrates the **Anthropic API (Claude)** to summarize market-moving headlines into clean, actionable, structured bullet points.
*   📱 **Responsive Dark-Theme UI**: Built with a sleek dark aesthetic using Tailwind CSS and interactive charts.

---

## 🛠️ Tech Stack
*   **Backend**: Node.js, Express.js, Axios
*   **Frontend**: HTML5, CSS3, JavaScript (ES6+), Tailwind CSS, Chart.js
*   **APIs**: Yahoo Finance (Market Data), Livemint RSS (News), Anthropic Claude (AI Summarization)

---

## 📁 Project Structure
```text
finsight/
├── server.js          # Express.js server & API proxies (Yahoo/RSS/Anthropic)
├── index.html         # Frontend Dashboard SPA (HTML, Tailwind CSS, charts)
├── package.json       # Node dependency and scripts configuration
├── package-lock.json  # NPM lock file
└── .gitignore         # Ignores node_modules, env, and log files
```

---

## ⚙️ Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/prem24-29/Finsight.git
cd Finsight
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set Environment Variables
Create a `.env` file in the root directory (or set them directly in your environment):
```env
PORT=3000
ANTHROPIC_API_KEY=your_anthropic_api_key_here
NEWS_API_KEY=your_optional_news_api_key_here
```

### 4. Run the application
```bash
# Start the production server
npm start

# Or run in development mode
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to view the dashboard.
