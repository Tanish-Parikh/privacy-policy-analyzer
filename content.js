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
    k: ['share', 'disclosure', 'disclose', 'third party', 'third-party', 'partners'],
    type: 'Data Sharing',
    risk: 'medium',
    simple: 'Your data may be shared with others.'
  },
  {
    k: ['sell', 'sold', 'monetize', 'commercial'],
    type: 'Data Sale',
    risk: 'high',
    simple: 'Your data may be sold to companies.'
  },
  {
    k: ['retain', 'retention', 'store', 'keep', 'period'],
    type: 'Data Retention',
    risk: 'medium',
    simple: 'Your data may be stored for a long time.'
  },
  {
    k: ['cookies', 'tracking', 'pixel', 'beacon', 'fingerprint'],
    type: 'Tracking',
    risk: 'medium',
    simple: 'Your activity may be tracked online.'
  },
  {
    k: ['collect', 'collection', 'gather', 'obtain'],
    type: 'Data Collection',
    risk: 'medium',
    simple: 'The service collects your personal data.'
  },
  {
    k: ['location', 'gps', 'geolocation'],
    type: 'Location Data',
    risk: 'high',
    simple: 'Your location data may be tracked.'
  },
  {
    k: ['advertising', 'ads', 'targeted', 'marketing'],
    type: 'Advertising',
    risk: 'medium',
    simple: 'Your data may be used for targeted advertising.'
  },
  {
    k: ['delete', 'deletion', 'opt-out', 'opt out', 'withdraw'],
    type: 'User Rights',
    risk: 'low',
    simple: 'You have the right to delete or opt out of data collection.'
  },
  {
    k: ['security', 'encrypt', 'protect', 'safeguard'],
    type: 'Security',
    risk: 'low',
    simple: 'Your data is protected with security measures.'
  }
];

/* ─── Extract clauses (p AND li, deduped, up to 600 chars) ─── */
function extractClauses() {
  const seen = new Set();
  const results = [];

  document.querySelectorAll('p, li').forEach(el => {
    const text = el.innerText.replace(/\s+/g, ' ').trim();
    if (text.length > 40 && text.length < 600 && !seen.has(text)) {
      seen.add(text);
      results.push(text);
    }
  });

  return results;
}

/* ─── Batch API call via Background script ─── */
function explainClauses(clauses) {
  const time = new Date().toLocaleTimeString();
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ 
      type: "EXPLAIN_CLAUSES", 
      clauses 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(`[${time}][Analyzer] Background error:`, chrome.runtime.lastError.message);
        resolve(clauses.map(() => null));
      } else if (response && response.success) {
        resolve(response.evaluations);
      } else {
        console.warn(`[${time}][Analyzer] Background fetch failed:`, response?.error);
        resolve(clauses.map(() => null));
      }
    });
  });
}

/* ─── MAIN ANALYSIS ─── */
async function analyzePolicy() {
  const time = new Date().toLocaleTimeString();
  
  // Clear old results immediately so popup doesn't show stale data
  chrome.storage.local.remove(['clauses', 'score', 'grade', 'privacyRiskPct', 'riskCategory', 'error']);

  const clauses = extractClauses();
  const matchedResults = [];

  for (const clause of clauses) {
    let matchedRule = null;
    for (const r of rules) {
      if (r.k.some(k => clause.toLowerCase().includes(k))) {
        matchedRule = r;
        break;
      }
    }
    if (matchedRule) matchedResults.push({ clause, matchedRule });
  }

  // Sort by risk priority (high first) and take top 20 to balance depth and speed
  const riskOrder = { high: 0, medium: 1, low: 2 };
  const limitedResults = matchedResults
    .sort((a, b) => riskOrder[a.matchedRule.risk] - riskOrder[b.matchedRule.risk])
    .slice(0, 20);

  // Send ALL clauses in ONE batch API call via background script
  console.log(`[${time}][Analyzer] Requesting batch explanation via background script...`);
  const clauseTexts = limitedResults.map(r => r.clause);
  const aiExplanations = await explainClauses(clauseTexts);
  console.log(`[${time}][Analyzer] Background response received.`);

  const results = limitedResults.map(({ clause, matchedRule }, i) => {
    const ai = aiExplanations[i];
    const explanation = (ai && ai.length > 8) ? ai : matchedRule.simple;
    if (!ai) console.warn(`[${time}][Analyzer] No AI explanation for clause ${i + 1}, using fallback.`);
    return {
      text: clause,
      simple: explanation,
      type: matchedRule.type,
      risk: matchedRule.risk
    };
  });
  console.log(`[${time}][Analyzer] Finished processing ${results.length} clauses.`);

  const fullText = clauses.join(' ');
  const score = flesch(fullText);
  const grade = fleschGrade(score);

  const riskScore = results.reduce((s, c) => s + riskWeights[c.risk], 0);
  
  // Dynamic Max Risk: A score of 100+ is High Risk, 250+ is Critical.
  // We use 250 as the denominator for 100% risk visualization.
  const TOTAL_CEILING = 250; 
  const privacyRiskPct = Math.min(100, Math.round((riskScore / TOTAL_CEILING) * 100));

  const riskCategory =
    privacyRiskPct > 60 ? 'High Risk' :
    privacyRiskPct > 30 ? 'Moderate Risk' : 'Low Risk';

  chrome.storage.local.set({ clauses: results, score, grade, privacyRiskPct, riskCategory });
}

/* ─── Listener ─── */
chrome.runtime.onMessage.addListener((req) => {
  if (req.action === 'analyze') analyzePolicy();
});