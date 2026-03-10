function extractClauses() {
  const selectors = [
    'main', 'article', '[role="main"]',
    '.policy', '.terms', '.legal', '#content', '.content', '.main-content'
  ];

  let container = document.body;

  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el && el.innerText.length > 500) {
      container = el;
      break;
    }
  }

  const rawElements = Array.from(container.querySelectorAll('p, li'));

  const textBlocks = rawElements
    .map(el => el.innerText.trim())
    .filter(t => t.length > 20);

  const allText = textBlocks.join(' ');

  const sentences = allText.match(/[^.!?]+[.!?]+/g) || [];

  return sentences
    .map(c => c.trim())
    .filter(c => c.length > 20 && c.length < 500);
}

/* ─── Call your Vercel API ─── */

async function analyzeClause(clause) {

  try {

    const response = await fetch(
      "https://privacy-policy-analyzer-seven.vercel.app/api/analyze",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clause })
      }
    );

    const result = await response.json();

    return result;

  } catch (err) {

    return {
      type: "Unknown",
      risk_level: "low",
      explanation: "Could not analyze this clause"
    };

  }

}

/* ─── Process clauses ─── */

async function processClauses(clauses) {

  const results = [];

  for (const clause of clauses.slice(0, 25)) { // limit for performance

    const ai = await analyzeClause(clause);

    const risk = ai.risk_level || "low";

    let type = "General";

    if (ai.type === "data-sharing") type = "Data Sharing";
    if (ai.type === "data-collection") type = "Data Collection";

    results.push({
      text: clause,
      simple: ai.explanation || "No explanation",
      risk: risk,
      type: type,
      confidence: 70,
      clauseScore: risk === "high" ? 80 : risk === "medium" ? 60 : 30,
      detectedData: []
    });

  }

  return results;

}

/* ─── Message listener ─── */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === "analyze") {

    (async () => {

      const clauses = extractClauses();

      const analyzed = await processClauses(clauses);

      const score =
        100 - analyzed.filter(c => c.risk === "high").length * 10;

      chrome.storage.local.set({
        clauses: analyzed,
        score: Math.max(score, 10),
        grade: score > 70 ? "Easy" : score > 50 ? "Moderate" : "Difficult",
        privacyRiskPct: 100 - score,
        riskCategory:
          score > 70 ? "Low Risk" :
          score > 50 ? "Moderate Risk" :
          "High Risk"
      });

    })();

  }

});
