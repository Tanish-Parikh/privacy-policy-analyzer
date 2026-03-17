/* ─── Syllable counter ─── */
function countSyllables(word) {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:es|ed|e)$/, '');
  const m = word.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

/* ─── Flesch Reading Ease ─── */
function flesch(text) {
  const sentences = text.split(/[.!?]+/).filter(Boolean).length || 1;
  const words = text.split(/\s+/).filter(Boolean);
  const w = words.length || 1;

  let syllables = 0;
  words.forEach(x => syllables += countSyllables(x));

  const raw =
    206.835
    - 1.015 * (w / sentences)
    - 84.6 * (syllables / w);

  return Math.min(100, Math.max(0, Math.round(raw)));
}

/* ─── Grade label ─── */
function fleschGrade(score) {
  if (score >= 90) return 'Very Easy';
  if (score >= 80) return 'Easy';
  if (score >= 70) return 'Fairly Easy';
  if (score >= 60) return 'Standard';
  if (score >= 50) return 'Fairly Difficult';
  if (score >= 30) return 'Difficult';
  return 'Very Difficult';
}

/* ─── Risk weights ─── */
const riskWeights = { high: 9, medium: 5, low: 2 };

/* ─── Rule engine ─── */
const rules = [
  {
    k: ['share', 'disclosure', 'disclose'],
    type: 'Data Sharing',
    risk: 'medium',
    simple: 'Your data may be shared with others.'
  },
  {
    k: ['sell', 'sold', 'monetize'],
    type: 'Data Sale',
    risk: 'high',
    simple: 'Your data may be sold to companies.'
  },
  {
    k: ['retain', 'retention', 'store'],
    type: 'Data Retention',
    risk: 'medium',
    simple: 'Your data may be stored for a long time.'
  },
  {
    k: ['cookies', 'tracking', 'pixel'],
    type: 'Tracking',
    risk: 'medium',
    simple: 'Your activity may be tracked online.'
  }
];

/* ─── Extract clauses ─── */
function extractClauses() {
  const paragraphs = Array.from(document.querySelectorAll('p'));

  return paragraphs
    .map(p => p.innerText.replace(/\s+/g, ' ').trim())
    .filter(t => t.length > 50 && t.length < 400);
}

/* ─── API call ─── */
async function explainClause(clause) {
  try {
    const res = await fetch("https://privacy-policy-analyzer-seven.vercel.app/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ clause })
    });

    const data = await res.json();

    return data?.explanation || null;

  } catch (e) {
    console.log("API error:", e);
    return null;
  }
}

/* ─── MAIN ANALYSIS ─── */
async function analyzePolicy() {
  const clauses = extractClauses();
  const results = [];

  for (const clause of clauses) {

    let matchedRule = null;

    for (const r of rules) {
      if (r.k.some(k => clause.toLowerCase().includes(k))) {
        matchedRule = r;
        break;
      }
    }

    if (!matchedRule) continue;

    let explanation = matchedRule.simple;

    const ai = await explainClause(clause);

    // ✅ FINAL FIX: ALWAYS USE AI IF AVAILABLE
    if (ai && ai.length > 8) {
      explanation = ai;
    } else {
      explanation = matchedRule.simple; // fallback (clean)
    }

    results.push({
      text: clause,
      simple: explanation,
      type: matchedRule.type,
      risk: matchedRule.risk
    });
  }

  const fullText = clauses.join(" ");
  const score = flesch(fullText);
  const grade = fleschGrade(score);

  const riskScore = results.reduce((s, c) => s + riskWeights[c.risk], 0);
  const privacyRiskPct = Math.min(100, Math.round((riskScore / 100) * 100));

  const riskCategory =
    privacyRiskPct > 60 ? "High Risk" :
      privacyRiskPct > 30 ? "Moderate Risk" :
        "Low Risk";

  chrome.storage.local.set({
    clauses: results,
    score,
    grade,
    privacyRiskPct,
    riskCategory
  });
}

/* ─── Listener ─── */
chrome.runtime.onMessage.addListener((req) => {
  if (req.action === "analyze") {
    analyzePolicy();
  }
});