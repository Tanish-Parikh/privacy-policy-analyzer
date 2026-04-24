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
    if (legend) legend.textContent = '';
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
    legend.textContent = '';
    const items = [
      { color: '#f87171', label: 'High', count: counts.high },
      { color: '#fbbf24', label: 'Med', count: counts.medium },
      { color: '#34d399', label: 'Low', count: counts.low }
    ];
    
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'legend-item';
      
      const dot = document.createElement('span');
      dot.className = 'legend-dot';
      dot.style.background = item.color;
      
      div.appendChild(dot);
      div.appendChild(document.createTextNode(` ${item.label} (${item.count})`));
      legend.appendChild(div);
    });
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

  const riskLevel = riskPct > 60 ? 'high-risk' : riskPct > 30 ? 'moderate risk' : 'low-risk';
  if (elements.summaryText) {
    elements.summaryText.textContent = '';
    
    const part1 = document.createTextNode('This policy is ');
    const gradeStrong = document.createElement('strong');
    gradeStrong.textContent = grade.toLowerCase();
    
    const part2 = document.createTextNode(' to read and holds a ');
    const riskStrong = document.createElement('strong');
    riskStrong.textContent = riskLevel;
    
    const part3 = document.createTextNode(' profile. ');
    
    const findingsStrong = document.createElement('strong');
    if (counts.high > 0) {
      findingsStrong.textContent = `${counts.high} high-risk`;
    }
    
    const part4 = document.createTextNode(counts.high > 0 ? ' clauses.' : 
                  counts.medium > 0 ? `It contains ${counts.medium} medium-risk clauses.` : 
                  `It mostly contains low-risk practices.`);

    elements.summaryText.append(part1, gradeStrong, part2, riskStrong, part3);
    if (counts.high > 0) {
      elements.summaryText.appendChild(findingsStrong);
    }
    elements.summaryText.appendChild(part4);
  }

  // Detailed Risks
  if (elements.detailedRisks && elements.detailedRisksList) {
    const highRisks = data.filter(c => c.risk === 'high' || c.risk === 'medium').slice(0, 3);
    elements.detailedRisks.classList.toggle('hidden', highRisks.length === 0);
    elements.detailedRisksList.textContent = '';
    highRisks.forEach(c => {
      const item = document.createElement('div');
      item.className = 'risk-item';
      
      const dot = document.createElement('span');
      dot.className = 'risk-bullet';
      dot.style.background = riskMeta[c.risk].color;
      
      const textDiv = document.createElement('div');
      textDiv.className = 'risk-text';
      
      const title = document.createElement('div');
      title.className = 'risk-title';
      title.textContent = c.type;
      
      const context = document.createElement('div');
      context.className = 'risk-context';
      context.textContent = c.text.substring(0, 40) + '...';
      
      textDiv.append(title, context);
      item.append(dot, textDiv);
      elements.detailedRisksList.appendChild(item);
    });
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
      elements.cardsBox.textContent = '';
    }
    if (elements.summaryView) elements.summaryView.classList.add('hidden');

    const filtered = data.filter(c => {
      const tabMatch = activeFilter === 'all' || (activeFilter === 'share' && c.type === 'Data Sharing');
      const riskMatch = activeRisks.has(c.risk);
      return tabMatch && riskMatch;
    });

    if (filtered.length === 0) {
      if (elements.cardsBox) {
        elements.cardsBox.textContent = '';
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.textContent = '✅ No matching clauses found.';
        elements.cardsBox.appendChild(emptyDiv);
      }
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

      const header = document.createElement('div');
      header.className = 'card-header';
      
      const riskSpan = document.createElement('span');
      riskSpan.className = m.cls;
      riskSpan.textContent = m.label;
      
      const typeSpan = document.createElement('span');
      typeSpan.className = 'card-type';
      typeSpan.textContent = c.type;
      
      header.append(riskSpan, typeSpan);
      
      const previewDiv = document.createElement('div');
      previewDiv.className = 'clause-preview';
      previewDiv.textContent = preview;
      
      d.append(header, previewDiv);

      if (hasMore) {
        const fullDiv = document.createElement('div');
        fullDiv.className = 'clause-full';
        fullDiv.style.display = 'none';
        fullDiv.textContent = c.text;
        
        const btn = document.createElement('button');
        btn.className = 'toggle-btn';
        btn.textContent = 'View More';
        btn.onclick = () => {
          const isHidden = fullDiv.style.display === 'none';
          fullDiv.style.display = isHidden ? 'block' : 'none';
          previewDiv.style.display = isHidden ? 'none' : 'block';
          btn.textContent = isHidden ? 'View Less' : 'View More';
        };
        d.append(fullDiv, btn);
      }
      
      const expDiv = document.createElement('div');
      expDiv.className = 'exp';
      expDiv.textContent = explanation;
      
      d.append(expDiv);
      if (elements.cardsBox) elements.cardsBox.appendChild(d);

    });
  }
}

/* ───────── Analyze Function ───────── */
async function analyzePolicy() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'analyze' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await new Promise(r => setTimeout(r, 250));
    await chrome.tabs.sendMessage(tab.id, { action: 'analyze' });
  }

  const messages = [
    "Scanning for hidden privacy risks...",
    "Simplifying complex legal jargon...",
    "Calculating safety and trust scores...",
    "Consulting the Gemini 2.x AI...",
    "Evaluating data retention policies...",
    "Mapping third-party sharing rules...",
    "Reviewing user rights and opt-outs..."
  ];
  let msgIdx = 0;
  const msgInterval = setInterval(() => {
    if (elements.loadingDesc) {
      elements.loadingDesc.style.opacity = 0;
      setTimeout(() => {
        elements.loadingDesc.textContent = messages[msgIdx];
        elements.loadingDesc.style.opacity = 1;
        msgIdx = (msgIdx + 1) % messages.length;
      }, 300);
    }
  }, 2500);

  const poll = setInterval(() => {
    chrome.storage.local.get(null, d => {
      if (d.score !== undefined || d.error) {
        clearInterval(poll);
        clearInterval(msgInterval);
        if (elements.loadingView) elements.loadingView.classList.add('hidden');
        data = d.clauses || [];
        if (!d.score) {
          return;
        }

        const counts = {
          high: data.filter(c => c.risk === 'high').length,
          medium: data.filter(c => c.risk === 'medium').length,
          low: data.filter(c => c.risk === 'low').length
        };

        updateGauge(d.score);
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
  // Always clear stale results and run a fresh analysis for the current page
  chrome.storage.local.remove(['clauses', 'score', 'grade', 'privacyRiskPct', 'riskCategory', 'error'], () => {
    analyzePolicy();
  });
});