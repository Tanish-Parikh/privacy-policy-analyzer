let data = [];
let activeFilter = 'all';
let activeRisks = new Set(['high', 'medium', 'low']);

const riskMeta = {
  high: { cls: 'high', label: 'HIGH RISK', color: '#f87171' },
  medium: { cls: 'medium', label: 'MEDIUM RISK', color: '#fbbf24' },
  low: { cls: 'low', label: 'LOW RISK', color: '#34d399' }
};

/* ───────── UI Elements ───────── */
const elements = {
  loadingView: document.getElementById('loading-view'),
  cardsBox: document.getElementById('cards'),
  summaryView: document.getElementById('summary-view'),
  scoreEl: document.getElementById('score'),
  gradeLabel: document.getElementById('gradeLabel'),
  riskPanel: document.getElementById('risk-panel'),
  riskPct: document.getElementById('risk-pct'),
  riskBarFill: document.getElementById('risk-bar-fill'),
  riskCategory: document.getElementById('risk-category'),
  summaryText: document.getElementById('summary-text'),
  filterBtn: document.getElementById('filter-btn'),
  filterDropdown: document.getElementById('filter-dropdown'),
  recSection: document.getElementById('recommendation-section'),
  recIcon: document.getElementById('rec-icon'),
  recTitle: document.getElementById('rec-title'),
  recDesc: document.getElementById('rec-desc'),
  detailedRisks: document.getElementById('detailed-risks-section'),
  detailedRisksList: document.getElementById('detailed-risks-list'),
  loadingTitle: document.getElementById('loading-title'),
  loadingDesc: document.getElementById('loading-desc')
};

/* ───────── Background Connection ───────── */
// Keep a connection to detect when popup is closed (for cache clearing)
const port = chrome.runtime.connect({ name: "popup" });

/* ───────── Gauge ───────── */
function updateGauge(score) {
  if (!elements.scoreEl) return;
  elements.scoreEl.textContent = score;

  const status = score >= 70 ? 'good' : score >= 50 ? 'moderate' : 'high-risk';
  elements.scoreEl.className = 'score ' + status;

  const arc = document.getElementById('arc');
  const arcGlow = document.getElementById('arc-glow');
  if (!arc || !arcGlow) return;

  const offset = 251 - (score / 100) * 251;
  arc.style.strokeDashoffset = offset;
  arcGlow.style.strokeDashoffset = offset;
  arc.setAttribute('opacity', '1');
  arcGlow.setAttribute('opacity', '0.2');

  arcGlow.style.stroke = score >= 70 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171';
}


/* ───────── Risk Chart ───────── */
function renderRiskChart(counts) {
  const chart = document.getElementById('risk-chart');
  const legend = document.getElementById('risk-legend');
  const total = counts.high + counts.medium + counts.low;

  if (total === 0) {
    if (chart) chart.style.background = 'var(--border-color)';
    if (legend) legend.innerHTML = '';
    return;
  }

  const hp = (counts.high / total) * 100;
  const mp = (counts.medium / total) * 100;

  if (chart) {
    chart.style.background = `conic-gradient(
      #f87171 0% ${hp}%,
      #fbbf24 ${hp}% ${hp + mp}%,
      #34d399 ${hp + mp}% 100%
    )`;
  }

  if (legend) {
    legend.innerHTML = `
      <div class="legend-item"><span class="legend-dot" style="background:#f87171"></span> High (${counts.high})</div>
      <div class="legend-item"><span class="legend-dot" style="background:#fbbf24"></span> Med (${counts.medium})</div>
      <div class="legend-item"><span class="legend-dot" style="background:#34d399"></span> Low (${counts.low})</div>
    `;
  }
}

/* ───────── Summary & Recommendations ───────── */
function generateSummary(counts, grade, riskPct) {
  if (elements.gradeLabel) elements.gradeLabel.textContent = grade;
  
  if (elements.riskPanel) {
    elements.riskPanel.classList.remove('hidden');
    if (elements.riskPct) {
      elements.riskPct.textContent = riskPct;
      elements.riskPct.style.color = riskPct > 60 ? '#f87171' : riskPct > 30 ? '#fbbf24' : '#34d399';
    }
    if (elements.riskBarFill) {
      elements.riskBarFill.style.width = `${riskPct}%`;
      elements.riskBarFill.style.background = riskPct > 60 ? '#f87171' : riskPct > 30 ? '#fbbf24' : '#34d399';
      elements.riskBarFill.style.boxShadow = riskPct > 60
        ? '0 0 8px rgba(248,113,113,0.5)'
        : riskPct > 30 ? '0 0 8px rgba(251,191,36,0.5)' : '0 0 8px rgba(52,211,153,0.5)';
    }
    if (elements.riskCategory) {
      const cat = riskPct > 60 ? 'High Risk' : riskPct > 30 ? 'Moderate' : 'Low Risk';
      elements.riskCategory.textContent = cat;
      const colorClass = riskPct > 60 ? 'high' : riskPct > 30 ? 'medium' : 'low';
      elements.riskCategory.className = 'risk-category-badge ' + colorClass;
      elements.riskCategory.style.color = riskPct > 60 ? '#f87171' : riskPct > 30 ? '#fbbf24' : '#34d399';
      elements.riskCategory.style.borderColor = riskPct > 60 ? 'rgba(248,113,113,0.3)' : riskPct > 30 ? 'rgba(251,191,36,0.3)' : 'rgba(52,211,153,0.3)';
    }
  }

  let riskLevel = riskPct > 60 ? 'high-risk' : riskPct > 30 ? 'moderate risk' : 'low-risk';
  let overview = `This policy is <strong>${grade.toLowerCase()}</strong> to read and holds a <strong>${riskLevel}</strong> profile. `;
  let findings = counts.high > 0 ? `It contains <strong>${counts.high} high-risk</strong> clauses.` : 
                 counts.medium > 0 ? `It contains ${counts.medium} medium-risk clauses.` : 
                 `It mostly contains low-risk practices.`;

  if (elements.summaryText) elements.summaryText.innerHTML = overview + findings;

  // Detailed Risks
  if (elements.detailedRisks && elements.detailedRisksList) {
    const highRisks = data.filter(c => c.risk === 'high' || c.risk === 'medium').slice(0, 3);
    elements.detailedRisks.classList.toggle('hidden', highRisks.length === 0);
    elements.detailedRisksList.innerHTML = highRisks.map(c => `
      <div class="risk-item">
        <span class="risk-bullet" style="background:${riskMeta[c.risk].color}"></span>
        <div class="risk-text">
          <div class="risk-title">${c.type}</div>
          <div class="risk-context">${c.text.substring(0, 40)}...</div>
        </div>
      </div>
    `).join('');
  }

  // Recommendations
  if (elements.recSection) {
    elements.recSection.classList.remove('hidden');
    const isGood = riskPct < 40 && (grade.includes('Easy') || grade.includes('Standard'));
    
    if (elements.recIcon) elements.recIcon.textContent = isGood ? '✅' : '⚠️';
    if (elements.recTitle) elements.recTitle.textContent = isGood ? 'Recommended to Accept' : 'Exercise Caution';
    if (elements.recDesc) {
      elements.recDesc.textContent = isGood 
        ? 'This policy aligns with standard privacy practices and is easy to understand.' 
        : 'This policy contains significant risks or is difficult to read. Review key clauses.';
    }
  }
}

/* ───────── Render Clauses ───────── */
function render(filter) {
  if (filter !== undefined) activeFilter = filter;

  // Update button active states
  ['all', 'summary', 'share'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', activeFilter === id);
  });

  if (activeFilter === 'summary') {
    if (elements.cardsBox) elements.cardsBox.classList.add('hidden');
    if (elements.summaryView) elements.summaryView.classList.remove('hidden');
  } else {
    if (elements.cardsBox) {
      elements.cardsBox.classList.remove('hidden');
      elements.cardsBox.innerHTML = '';
    }
    if (elements.summaryView) elements.summaryView.classList.add('hidden');

    const filtered = data.filter(c => {
      const tabMatch = activeFilter === 'all' || (activeFilter === 'share' && c.type === 'Data Sharing');
      const riskMatch = activeRisks.has(c.risk);
      return tabMatch && riskMatch;
    });

    if (filtered.length === 0) {
      if (elements.cardsBox) elements.cardsBox.innerHTML = `<div class="empty-state">✅ No matching clauses found.</div>`;
      return;
    }

    filtered.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = 'card';
      d.style.animationDelay = `${i * 45}ms`;
      const m = riskMeta[c.risk] || riskMeta.medium;
      const preview = c.text.length > 120 ? c.text.substring(0, 120) + '...' : c.text;
      const hasMore = c.text.length > 120;
      const explanation = c.simple || "Explanation unavailable";

      d.innerHTML = `
        <div class="card-header">
          <span class="${m.cls}">${m.label}</span>
          <span class="card-type">${c.type}</span>
        </div>
        <div class="clause-preview">${preview}</div>
        ${hasMore ? `<div class="clause-full" style="display:none">${c.text}</div><button class="toggle-btn">View More</button>` : ''}
        <div class="exp">${explanation}</div>
      `;
      if (elements.cardsBox) elements.cardsBox.appendChild(d);

      const toggleBtn = d.querySelector('.toggle-btn');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          const full = d.querySelector('.clause-full');
          const prev = d.querySelector('.clause-preview');
          const isHidden = full.style.display === 'none';
          full.style.display = isHidden ? 'block' : 'none';
          prev.style.display = isHidden ? 'none' : 'block';
          toggleBtn.textContent = isHidden ? 'View Less' : 'View More';
        });
      }
    });
  }
}

/* ───────── Analyze Function ───────── */
async function analyzePolicy() {
  // Show loading state
  if (elements.loadingView) elements.loadingView.classList.remove('hidden');

  // Cycle loading messages for better feedback
  const statuses = [
    { t: "Scanning Content...", d: "Identifying paragraphs and extracting text." },
    { t: "Identifying Risks...", d: "Mapping clauses to privacy rules and risk levels." },
    { t: "Simplifying with AI...", d: "Asking Gemini to translate legal jargon to plain English." },
    { t: "Calculating Score...", d: "Finalizing the risk profile and readability grade." }
  ];
  let sIdx = 0;
  const statusInterval = setInterval(() => {
    sIdx = (sIdx + 1) % statuses.length;
    if (elements.loadingTitle) elements.loadingTitle.textContent = statuses[sIdx].t;
    if (elements.loadingDesc) elements.loadingDesc.textContent = statuses[sIdx].d;
  }, 4000);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'analyze' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await new Promise(r => setTimeout(r, 250));
    await chrome.tabs.sendMessage(tab.id, { action: 'analyze' });
  }

  const poll = setInterval(() => {
    chrome.storage.local.get(null, d => {
      // Check if analysis is complete or errored
      if (d.score !== undefined || d.error) {
        clearInterval(poll);
        clearInterval(statusInterval);
        data = d.clauses || [];
        
        // Hide loading state
        if (elements.loadingView) {
          elements.loadingView.classList.add('hidden');
        }

        if (!d.score && !d.error) return;

        const counts = {
          high: data.filter(c => c.risk === 'high').length,
          medium: data.filter(c => c.risk === 'medium').length,
          low: data.filter(c => c.risk === 'low').length
        };

        updateGauge(d.score || 0);
        renderRiskChart(counts);
        generateSummary(counts, d.grade || 'Unknown', d.privacyRiskPct || 0);

        render('summary');
      }
    });
  }, 400);
}


/* ───────── Tabs ───────── */
const allTab = document.getElementById('all');
if (allTab) allTab.onclick = () => render('all');

const summaryTab = document.getElementById('summary');
if (summaryTab) summaryTab.onclick = () => render('summary');

const shareTab = document.getElementById('share');
if (shareTab) shareTab.onclick = () => render('share');

/* ───────── Filters ───────── */
if (elements.filterBtn) {
  elements.filterBtn.onclick = (e) => {
    e.stopPropagation();
    if (elements.filterDropdown) elements.filterDropdown.classList.toggle('hidden');
  };
}

document.addEventListener('click', () => {
  if (elements.filterDropdown) elements.filterDropdown.classList.add('hidden');
});

if (elements.filterDropdown) {
  elements.filterDropdown.addEventListener('click', (e) => e.stopPropagation());
}

['high', 'medium', 'low'].forEach(r => {
  const chk = document.getElementById(`chk-${r}`);
  if (chk) {
    chk.onchange = () => {
      if (chk.checked) activeRisks.add(r);
      else activeRisks.delete(r);
      render();
    };
  }
});

/* ───────── Theme ───────── */
function initTheme() {
  chrome.storage.local.get('theme', (result) => {
    if (result.theme === 'light') document.body.classList.add('light-theme');
  });

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-theme');
      chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  // Always trigger auto-analysis on popup load for fresh results
  analyzePolicy();
});