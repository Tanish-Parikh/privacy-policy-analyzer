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

/* ─── Flesch grade label ─── */
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

/* ─── Keyword rules (UNCHANGED) ─── */
const rules = [
  {
    k: ['share', 'disclosure', 'disclose'],
    type: 'Data Sharing',
    risk: 'medium',
    simple: 'Your personal data may be shared with external entities.'
  },
  {
    k: ['sell', 'sold', 'monetize'],
    type: 'Data Sale',
    risk: 'high',
    simple: 'Your data may be sold to other companies.'
  },
  {
    k: ['retain', 'storage', 'store'],
    type: 'Data Retention',
    risk: 'medium',
    simple: 'Your data could be stored for a long time.'
  },
  {
    k: ['cookies', 'tracking', 'pixel'],
    type: 'Tracking',
    risk: 'medium',
    simple: 'Your browsing activity may be tracked.'
  }
];


/* ───────────────────────────── */
/* ─── NEW: AI CLAUSE EXPLAIN ─── */
/* ───────────────────────────── */

async function explainClause(clause) {

  try {

    const res = await fetch(
      "https://privacy-policy-analyzer-seven.vercel.app/api/analyze",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clause })
      }
    );

    const data = await res.json();

    if (data && data.explanation) {
      return data.explanation;
    }

  } catch (e) {
    console.log("AI explain failed");
  }

  return null;
}


/* ───────────────────────────── */
/* ─── Extract clauses ───────── */
/* ───────────────────────────── */

function extractClauses() {

  const container =
    document.querySelector("main")
    || document.querySelector("article")
    || document.body;

  const elements =
    Array.from(container.querySelectorAll("p,li"));

  const clauses =
    elements
      .map(e => e.innerText.trim())
      .filter(t => t.length > 30 && t.length < 500);

  return clauses;

}


/* ───────────────────────────── */
/* ─── MAIN ANALYSIS ─────────── */
/* ───────────────────────────── */

async function analyzePolicy() {

  const clauses = extractClauses();

  let results = [];

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

    /* ─── API override ─── */
    const ai = await explainClause(clause);
    if (ai) explanation = ai;

    results.push({
      text: clause,
      simple: explanation,
      type: matchedRule.type,
      risk: matchedRule.risk
    });

  }

  /* ─── Compute readability ─── */

  const fullText = clauses.join(" ");
  const score = flesch(fullText);
  const grade = fleschGrade(score);

  const riskScore =
    results.reduce(
      (s, c) => s + riskWeights[c.risk],
      0
    );

  const privacyRiskPct =
    Math.min(100, Math.round((riskScore / 100) * 100));

  const riskCategory =
    privacyRiskPct > 60
      ? "High Risk"
      : privacyRiskPct > 30
        ? "Moderate Risk"
        : "Low Risk";


  chrome.storage.local.set({
    clauses: results,
    score,
    grade,
    privacyRiskPct,
    riskCategory
  });

}


/* ───────────────────────────── */
/* ─── Message Listener ──────── */
/* ───────────────────────────── */

chrome.runtime.onMessage.addListener(
  (req, sender, res) => {

    if (req.action === "analyze") {

      analyzePolicy();

    }

  }
);