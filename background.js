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
      console.log(`[${time}][Background] Raw Body: ${text.substring(0, 500)}`);
      
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
