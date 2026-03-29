chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "EXPLAIN_CLAUSES") {
    const { clauses } = request;
    
    console.log(`[Background] Received request for ${clauses.length} clauses.`);
    
    fetch("https://privacy-policy-analyzer-seven.vercel.app/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clauses })
    })
    .then(res => {
      console.log(`[Background] API Status: ${res.status}`);
      return res.json();
    })
    .then(data => {
      console.log(`[Background] API Success, sending response back.`);
      sendResponse({ success: true, evaluations: data.explanations });
    })
    .catch(err => {
      console.error(`[Background] API Fetch error:`, err);
      sendResponse({ success: false, error: err.message });
    });

    return true; // Keep the message channel open for async response
  }
});
