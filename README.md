# Privacy Policy Analyzer 🛡️

A modern, lightweight browser extension that uses AI (via Groq) to simplify complex privacy policies into human-readable summaries.

## ✨ Features
- **Instant Analysis**: Breaks down policy paragraphs into clear, one-sentence explanations.
- **Risk Scoring**: Visual gauge showing the readability and privacy risk of the current site.
- **Smart Filtering**: Filter clauses by High, Medium, or Low risk.
- **Dark Mode Support**: Beautifully designed UI with glassmorphism and ambient animations.
- **Serverless Backend**: Powered by Vercel and Groq's Llama 3 for fast processing.

## 🚀 Installation

### 1. Backend Setup (Vercel)
The extension requires a backend to communicate with the Groq API.
1. Fork/Clone this repo.
2. Deploy to Vercel:
   ```bash
   vercel
   ```
3. Add `GROQ_API_KEY` to your Vercel Environment Variables.
4. Update `content.js` and `manifest.json` with your production Vercel URL.

### 2. Extension Setup (Chrome/Edge/Brave)
1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this project folder.

## 🛠️ Tech Stack
- **Frontend**: Vanilla JS, HTML, CSS (Custom Glassmorphism Design).
- **Backend**: Node.js (Vercel Serverless Functions).
- **AI**: Groq (Llama 3 8B).

## 📄 License
MIT
