chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "EXPLAIN_CLAUSES") {
    const time = new Date().toLocaleTimeString();
    const { clauses } = request;
    
    console.log(`[${time}][Background] Received request for ${clauses.length} clauses.`);
    
    fetch("https://privacy-policy-analyzer-seven.vercel.app/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clauses })
    })
    .then(async res => {
      console.log(`[${time}][Background] API Status: ${res.status}`);
      const text = await res.text();
      
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
      
      const data = JSON.parse(text);
      if (!Array.isArray(data?.explanations)) throw new Error("Missing explanations array in JSON");
      
      sendResponse({ success: true, evaluations: data.explanations });
    })
    .catch(err => {
      console.error(`[${time}][Background] API Fetch error:`, err);
      sendResponse({ success: false, error: err.message });
    });

    return true; // Keep the message channel open for async response
  }
});

// Clear cache when popup is closed
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    port.onDisconnect.addListener(() => {
      const time = new Date().toLocaleTimeString();
      console.log(`[${time}][Background] Popup closed. Clearing analysis cache.`);
      chrome.storage.local.get('theme', (res) => {
        chrome.storage.local.clear(() => {
          if (res.theme) chrome.storage.local.set({ theme: res.theme });
        });
      });
    });
  }
});

