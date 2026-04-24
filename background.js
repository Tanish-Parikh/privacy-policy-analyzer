let lastRequestTime = 0;
const COOLDOWN_MS = 5000; // 5 seconds
const API_URL = "https://privacy-policy-analyzer-seven.vercel.app/api/analyze";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "EXPLAIN_CLAUSES") {
    const time = new Date().toLocaleTimeString();
    const now = Date.now();
    const { clauses } = request;

    if (now - lastRequestTime < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (now - lastRequestTime)) / 1000);
      console.warn(`[${time}][Background] Cooldown: Wait ${waitSec}s.`);
      sendResponse({ error: `Please wait ${waitSec}s` });
      return true;
    }

    lastRequestTime = now;
    console.log(`[${time}][Background] Calling API: ${API_URL}`);
    
    fetch("https://privacy-policy-analyzer-seven.vercel.app/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clauses })
    })
    .then(async res => {
      console.log(`[${time}][Background] API Status: ${res.status}`);
      const data = await res.json();
      
      if (!res.ok || data.error) {
        const errorMsg = data.error || `HTTP ${res.status}`;
        console.error(`[${time}][Background] API Error:`, errorMsg);
        throw new Error(errorMsg);
      }
      
      if (!Array.isArray(data?.explanations)) {
        console.error(`[${time}][Background] Invalid API Response:`, data);
        throw new Error("Missing explanations array in JSON");
      }
      
      console.log(`[${time}][Background] Success! Model used: ${data.model_used || 'unknown'}`);
      sendResponse({ success: true, explanations: data.explanations });
    })
    .catch(err => {
      console.error(`[${time}][Background] API Fetch error:`, err);
      sendResponse({ success: false, error: err.message });
    });

    return true; // Keep the message channel open for async response
  }

  if (request.type === "FETCH_REMOTE_CONTENT") {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}][Background] Fetching remote policy: ${request.url}`);

    fetch(request.url)
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        sendResponse({ success: true, html });
      })
      .catch(err => {
        console.error(`[${time}][Background] Fetch error:`, err);
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }
});

// Clear cache when popup is closed
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    port.onDisconnect.addListener(() => {
      const time = new Date().toLocaleTimeString();
      console.log(`[${time}][Background] Popup closed.`);
    });
  }
});

