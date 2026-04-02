# Privacy Policy Analyzer 🛡️
### Simplifying Privacy Policies with AI Power

**Privacy Policy Analyzer** is a modern, full-stack browser extension designed to help users navigate the complex landscape of digital privacy. Built with **Vanilla JavaScript**, **Vercel Serverless Functions**, and powered by **Google's Gemini 2.5 AI**, it instantly simplifies dense legal text into human-readable insights, risk scores, and actionable recommendations.

**Live Demo:** [privacy-analyzer-demo.vercel.app](https://privacy-policy-analyzer-seven.vercel.app)

---

## ✨ Features

- **🔍 Smart Analysis** — Automatically extracts and parses privacy policies from any website.
- **⚡ AI-Powered Summaries** — Simplifies complex legal jargon into clear, one-sentence explanations using Gemini.
- **📊 Risk Scoring** — Calculates a dynamic **Privacy Risk Score (0-100)** with category badges (High, Medium, Low).
- **📖 Readability Gauge** — Provides a readability grade (A-F) based on the policy's linguistic complexity.
- **🧪 Interactive Dashboard** — A premium, glassmorphic UI featuring gauges, progress bars, and animated blobs.
- **🛡️ Recommendations** — Suggests whether to "Accept" or "Proceed with Caution" based on standard privacy practices.
- **🌓 Adaptive Theme** — Beautifully designed dark and light modes with smooth transitions.
- **🚫 CSP Bypass** — Uses a background service worker to reliably fetch AI analysis without being blocked by site-level security policies.

---

## 🛠️ Tech Stack

| Category          | Technology                                   |
|-------------------|----------------------------------------------|
| **Frontend**      | Vanilla JavaScript (ES6+), HTML5             |
| **Styling**       | Vanilla CSS (Glassmorphism, Ambient Blobs)   |
| **Backend**       | Node.js 24 (Vercel Serverless Functions)     |
| **AI Engine**     | Google Gemini 2.5 (Flash)                    |
| **Extension**     | Manifest V3 (Service Workers, Scripting API) |
| **Fonts**         | Inter (Google Fonts)                         |
| **Deployment**    | Vercel                                       |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v24 or higher)
- **Vercel CLI** (for backend deployment)
- A **Gemini API Key** (obtainable from [Google AI Studio](https://aistudio.google.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Tanish-Parikh/privacy-policy-analyzer.git
   cd privacy-policy-analyzer
   ```

2. **Deploy the Backend**
   - Navigate to the project root and deploy to Vercel:
     ```bash
     vercel
     ```
   - Add your `GEMINI_API_KEY` to the Vercel project environment variables in the dashboard.
   - Note your production URL (e.g., `https://your-app.vercel.app`).

3. **Configure the Extension**
   - Open `manifest.json` and update `host_permissions` with your Vercel URL.
   - Open `background.js` and set the `API_URL` to your Vercel endpoint.

4. **Load the Extension**
   - Open Chrome/Edge/Brave and go to `chrome://extensions/`.
   - Enable **Developer Mode**.
   - Click **Load Unpacked** and select the `privacy-policy-analyzer` folder.

---

## 📂 Project Structure

```text
privacy-policy-analyzer/
├── api/                # Vercel Serverless Functions
│   └── analyze.js      # AI analysis endpoint (Gemini integration)
├── background.js       # Extension service worker (handles API calls)
├── content.js          # Content script (extracts page text)
├── manifest.json       # Extension configuration (Manifest V3)
├── popup.html          # Main extension interface
├── popup.css           # Styling (Glassmorphism & animations)
├── popup.js            # UI logic & data visualization
├── vercel.json         # Vercel deployment configuration
└── package.json        # Scripts and engine configuration
```

---

## 📜 Available Scripts

| Command             | Description                                  |
|---------------------|----------------------------------------------|
| `npm run dev`       | Start local Vercel development server        |
| `npm run deploy`    | Deploy the production backend to Vercel      |

---

## 🔑 Environment Variables

This project requires a **Gemini API Key** for the backend to function.

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

> **Important:** Never commit your `.env` file or API keys to a public repository.

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 🤝 Support & Links

- **Developer:** [Tanish Parikh](https://github.com/Tanish-Parikh)
- **Website:** [privacy-analyzer-demo.vercel.app](https://privacy-policy-analyzer-seven.vercel.app)

Built with ❤️ by Tanish Parikh
