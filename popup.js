document.addEventListener('DOMContentLoaded', initTheme);

function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const sunIcon = document.getElementById('sun-icon');
  const moonIcon = document.getElementById('moon-icon');

  chrome.storage.local.get('theme', (result) => {
    if (result.theme === 'light') {
      document.body.classList.add('light-theme');
      if (sunIcon) sunIcon.classList.remove('hidden');
      if (moonIcon) moonIcon.classList.add('hidden');
    }
  });

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-theme');
      chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });

      if (sunIcon) sunIcon.classList.toggle('hidden', !isLight);
      if (moonIcon) moonIcon.classList.toggle('hidden', isLight);
    });
  }
}

// 2. Call the deployed Vercel function
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
    if (!response.ok) {
      console.warn("API returned status:", response.status);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error("API call failed:", err);
    return null;
  }
}

document.getElementById('analyze').onclick = async () => {
  const btn = document.getElementById('analyze');
  const cardsBox = document.getElementById('cards');
  const statusEl = document.getElementById('status-message');

  btn.classList.add('loading');
  btn.innerHTML = '⏳ Extracting clauses…';
  cardsBox.innerHTML = '';
  statusEl.textContent = "Extracting text from page...";

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let clauses = [];
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'analyze' });
    if (res && res.clauses) clauses = res.clauses;
  } catch (e) {
    try {
      // Content script not loaded, inject it
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await new Promise(r => setTimeout(r, 200));
      const res = await chrome.tabs.sendMessage(tab.id, { action: 'analyze' });
      if (res && res.clauses) clauses = res.clauses;
    } catch (err) {
      statusEl.textContent = 'Cannot analyze this page.';
      btn.classList.remove('loading');
      btn.innerHTML = '🔍 Analyze Policy';
      return;
    }
  }

  if (!clauses || clauses.length === 0) {
    statusEl.textContent = 'No policy text found.';
    btn.classList.remove('loading');
    btn.innerHTML = '🔍 Analyze Policy';
    return;
  }

  // To prevent overwhelming the API or the user waiting too long,
  // cap analysis at a reasonable number of clauses for now.
  const limit = Math.min(clauses.length, 30);
  const targetClauses = clauses.slice(0, limit);

  statusEl.textContent = `Analyzing ${targetClauses.length} clauses with AI...`;
  let foundRisks = 0;

  for (let i = 0; i < targetClauses.length; i++) {
    const clause = targetClauses[i];
    statusEl.innerHTML = `Analyzing clause <strong>${i + 1}</strong> of ${targetClauses.length}...`;

    // 3. Call the API
    const result = await analyzeClause(clause);

    // 4. Only show medium / high risk
    if (result && (result.risk_level === 'medium' || result.risk_level === 'high')) {
      foundRisks++;
      renderResult(clause, result);
    }
  }

  if (foundRisks === 0) {
    statusEl.textContent = 'Analysis complete. No high/medium risks found in the analyzed section.';
    cardsBox.innerHTML = '<div class="empty-state">✅ Everything looks safe!</div>';
  } else {
    statusEl.innerHTML = `Analysis complete. Found <strong>${foundRisks}</strong> risks.`;
  }

  btn.classList.remove('loading');
  btn.innerHTML = '🔍 Analyze Policy';
};

// 5. Build dynamic result card
function renderResult(clause, result) {
  const cardsBox = document.getElementById('cards');
  const d = document.createElement('div');

  const isHigh = (result.risk_level === 'high');
  // Styling via classes added over in popup.css
  d.className = `card ${isHigh ? 'high-risk' : 'medium-risk'}`;

  d.innerHTML = `
    <div class="card-header" style="margin-bottom: 12px;">
      <span class="warning-title">
        ⚠ Risky Clause Detected
      </span>
      <span class="card-type">
        ${result.type ? result.type.toUpperCase() : 'ISSUE'}
      </span>
    </div>
    
    <div class="risk-label">Clause:</div>
    <div class="clause-text">"${clause}"</div>
    
    <div class="risk-label">Risk Level:</div>
    <div class="risk-value ${isHigh ? 'text-red' : 'text-yellow'}">${result.risk_level}</div>
    
    <div class="risk-label">Explanation:</div>
    <div class="exp">${result.explanation}</div>
  `;
  cardsBox.appendChild(d);
}
