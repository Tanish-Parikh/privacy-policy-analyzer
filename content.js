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

/* ─── Extract clauses (p, li, and divs as fallback, deduped, up to 600 chars) ─── */
function extractClauses(root = document) {
  const seen = new Set();
  const results = [];

  // Primary: p and li elements
  root.querySelectorAll('p, li').forEach(el => {
    const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length > 40 && text.length < 600 && !seen.has(text)) {
      seen.add(text);
      results.push(text);
    }
  });

  // Fallback: also check divs if we got very little from p/li
  if (results.length < 5) {
    root.querySelectorAll('div').forEach(el => {
      // Only leaf-like divs (no nested divs)
      if (el.querySelector('div')) return;
      const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length > 40 && text.length < 400 && !seen.has(text)) {
        seen.add(text);
        results.push(text);
      }
    });
  }

  return results;
}

/* ─── Find Privacy Policy Link ─── */
function findPrivacyLink() {
  const links = Array.from(document.querySelectorAll('a'));
  const keywords = ['privacy policy', 'privacy notice', 'privacy center', 'terms of service', 'terms & conditions'];
  
  for (const keyword of keywords) {
    const link = links.find(ln => ln.innerText.toLowerCase().includes(keyword));
    if (link && link.href && link.href.startsWith('http')) return link.href;
  }
  
  // Fallback to URL-based detection
  const privacyLink = links.find(ln => ln.href && (ln.href.toLowerCase().includes('privacy') || ln.href.toLowerCase().includes('policy')));
  return privacyLink ? privacyLink.href : null;
}

/* ─── Detect Signup/Login Page ─── */
function isSignupOrLoginPage() {
  const hasPassword = !!document.querySelector('input[type="password"]');
  const text = document.body.innerText.toLowerCase();
  const keywords = [
    'sign up', 'create account', 'register', 'login', 'sign in',
    'log in', 'log into', 'create new account', 'forgot password',
    'forgot your password', 'new account', 'join now'
  ];
  const hasKeyword = keywords.some(k => text.includes(k));
  return hasPassword && hasKeyword;
}

/* ─── Inject Risk Badge ─── */
function injectRiskBadge(category, riskPct) {
  if (document.getElementById('privacy-policy-badge')) return;

  const badge = document.createElement('div');
  badge.id = 'privacy-policy-badge';
  const cls = category.toLowerCase().replace(' ', '-');
  badge.className = `privacy-analyze-badge ${cls}`;
  
  const scoreDisplay = riskPct === '?' ? '?' : `${riskPct}%`;

  const dot = document.createElement('div');
  dot.className = 'badge-dot';
  
  const label = document.createElement('span');
  label.textContent = category;
  
  const score = document.createElement('div');
  score.className = 'badge-score';
  score.textContent = scoreDisplay;
  
  badge.append(dot, label, score);

  badge.onclick = () => {
    chrome.runtime.sendMessage({ action: "OPEN_POPUP" });
  };

  document.body.appendChild(badge);
}

/* ─── Lock ─── */
let isAnalyzing = false;

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
        resolve(response.explanations);
      } else {
        console.warn(`[${time}][Analyzer] Background fetch failed:`, response?.error);
        resolve(clauses.map(() => null));
      }
    });
  });
}

/* ─── MAIN ANALYSIS ─── */
async function analyzePolicy(isSilent = false) {
  if (isAnalyzing) return null;
  isAnalyzing = true;

  const time = new Date().toLocaleTimeString();
  
  try {
    if (!isSilent) {
      // Clear old results immediately so popup doesn't show stale data
      chrome.storage.local.remove(['clauses', 'score', 'grade', 'privacyRiskPct', 'riskCategory', 'error']);
    }

  let clauses = extractClauses();
  
  // If too few clauses, try following a link
  if (clauses.length < 10) {
    const link = findPrivacyLink();
    if (link) {
      console.log(`[${time}][Analyzer] Low content on page. Fetching linked policy: ${link}`);
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: "FETCH_REMOTE_CONTENT", url: link }, resolve);
      });

      if (response && response.success) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(response.html, 'text/html');
        const remoteClauses = extractClauses(doc);
        if (remoteClauses.length > clauses.length) {
          clauses = remoteClauses;
          console.log(`[${time}][Analyzer] Successfully fetched ${clauses.length} clauses from remote page.`);
        }
      }
    }
  }

  if (clauses.length === 0) {
    console.warn(`[${time}][Analyzer] No policy content found on local or remote page.`);
    if (isSilent) {
      // For proactive badge: can't read policy, warn user with a default medium-risk result
      console.log(`[${time}][Analyzer] Proactive mode: showing default caution badge.`);
      isAnalyzing = false;
      return {
        clauses: [],
        score: 50,
        grade: 'Unknown',
        privacyRiskPct: '?',
        riskCategory: 'Moderate Risk'
      };
    }
    chrome.storage.local.set({ error: "No policy content found." });
    isAnalyzing = false;
    return null;
  }
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

  // Balanced Distribution Logic: Ensure High, Med, and Low are all represented (Total limit: 20)
  const high = matchedResults.filter(r => r.matchedRule.risk === 'high');
  const med = matchedResults.filter(r => r.matchedRule.risk === 'medium');
  const low = matchedResults.filter(r => r.matchedRule.risk === 'low');

  const MAX_TOTAL = 15;
  const PER_BUCKET = Math.floor(MAX_TOTAL / 3); // Roughly 6-7 each

  // Take a baseline from each bucket
  let balanced = [
    ...high.slice(0, PER_BUCKET),
    ...med.slice(0, PER_BUCKET),
    ...low.slice(0, PER_BUCKET)
  ];

  // Fill remaining slots with whatever is left (prioritizing high > medium > low)
  const used = new Set(balanced);
  const remaining = matchedResults
    .filter(r => !used.has(r))
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.matchedRule.risk] - order[b.matchedRule.risk];
    });

  const limitedResults = balanced.concat(remaining.slice(0, MAX_TOTAL - balanced.length));

  // Send ALL clauses in ONE batch API call via background script
  const clauseTexts = limitedResults.map(r => r.clause);
  let aiExplanations = [];
  if (clauseTexts.length > 0) {
    console.log(`[${time}][Analyzer] Requesting batch explanation for ${clauseTexts.length} clauses...`);
    aiExplanations = await explainClauses(clauseTexts);
    console.log(`[${time}][Analyzer] Background response received.`);
  } else {
    console.log(`[${time}][Analyzer] No relevant clauses to explain via AI.`);
  }

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

  const analysisResults = { clauses: results, score, grade, privacyRiskPct, riskCategory };
  
  // Only update storage if we found something OR if the user manually requested it
  if (!isSilent || results.length > 0) {
    console.log(`[${time}][Analyzer] Saving ${results.length} results to storage.`);
    chrome.storage.local.set(analysisResults);
  }
  
  isAnalyzing = false;
  return analysisResults;
} catch (err) {
  console.error(`[${time}][Analyzer] Error during analysis:`, err);
  isAnalyzing = false;
  return null;
}
}

/* ─── Auto-Check for Signup/Login (with DOM-ready retries) ─── */
function tryProactiveBadge(attemptsLeft = 3) {
  if (document.getElementById('privacy-policy-badge')) return; // already injected

  if (isSignupOrLoginPage()) {
    console.log("[Analyzer] Signup/Login page detected. Running proactive analysis...");
    analyzePolicy(true).then(results => {
      if (results && results.riskCategory) {
        injectRiskBadge(results.riskCategory, results.privacyRiskPct);
      }
    });
  } else if (attemptsLeft > 0) {
    // Page may not have fully rendered yet — retry after a delay
    setTimeout(() => tryProactiveBadge(attemptsLeft - 1), 1000);
  }
}

// Run after DOM is ready (catches both static & dynamically rendered login pages)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => tryProactiveBadge());
} else {
  tryProactiveBadge(); // DOM already ready
}

/* ─── Listener ─── */
chrome.runtime.onMessage.addListener((req) => {
  if (req.action === 'analyze') analyzePolicy();
});