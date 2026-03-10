let data = [];
let activeFilter = 'all';
let activeRisks = new Set(['high', 'medium', 'low']);

const riskMeta = {
  high: { cls: 'high', label: 'HIGH RISK', color: '#f87171' },
  medium: { cls: 'medium', label: 'MEDIUM RISK', color: '#fbbf24' },
  low: { cls: 'low', label: 'LOW RISK', color: '#34d399' }
};

/* ───────── Gauge (MISSING FUNCTION FIX) ───────── */
function updateGauge(score) {

  const scoreEl = document.getElementById('score');
  if (!scoreEl) return;

  scoreEl.textContent = score;

  scoreEl.className =
    'score ' +
    (score >= 70 ? 'good' :
      score >= 50 ? 'moderate' :
        'high-risk');

  const arc = document.getElementById('arc');
  const arcGlow = document.getElementById('arc-glow');

  if (!arc || !arcGlow) return;

  const offset = 251 - (score / 100) * 251;

  arc.style.strokeDashoffset = offset;
  arcGlow.style.strokeDashoffset = offset;

  arc.setAttribute('opacity', '1');
  arcGlow.setAttribute('opacity', '0.2');

  arcGlow.style.stroke =
    score >= 70 ? '#34d399'
      : score >= 50 ? '#fbbf24'
        : '#f87171';
}

/* ───────── Risk Chart ───────── */

function renderRiskChart(counts) {

  const chart = document.getElementById('risk-chart');
  const legend = document.getElementById('risk-legend');

  const total = counts.high + counts.medium + counts.low;

  if (total === 0) {
    chart.style.background = 'var(--border-color)';
    legend.innerHTML = '';
    return;
  }

  const hp = (counts.high / total) * 100;
  const mp = (counts.medium / total) * 100;

  chart.style.background = `conic-gradient(
    #f87171 0% ${hp}%,
    #fbbf24 ${hp}% ${hp + mp}%,
    #34d399 ${hp + mp}% 100%
  )`;

  legend.innerHTML = `
    <div class="legend-item"><span class="legend-dot" style="background:#f87171"></span> High (${counts.high})</div>
    <div class="legend-item"><span class="legend-dot" style="background:#fbbf24"></span> Med (${counts.medium})</div>
    <div class="legend-item"><span class="legend-dot" style="background:#34d399"></span> Low (${counts.low})</div>
  `;
}

/* ───────── Summary Text ───────── */

function generateSummary(counts, readabilityGrade, privacyRiskPct) {

  const textEl = document.getElementById('summary-text');

  let riskLevel =
    privacyRiskPct > 60 ? 'high-risk' :
      privacyRiskPct > 30 ? 'moderate risk' :
        'low-risk';

  let overview =
    `This policy is <strong>${readabilityGrade.toLowerCase()}</strong> to read and holds a <strong>${riskLevel}</strong> profile. `;

  let findings = '';

  if (counts.high > 0) {
    findings += `It contains <strong>${counts.high} high-risk</strong> clauses. `;
  }
  else if (counts.medium > 0) {
    findings += `It contains ${counts.medium} medium-risk clauses. `;
  }
  else {
    findings += `It mostly contains low-risk practices. `;
  }

  textEl.innerHTML = overview + findings;
}

/* ───────── Render Clauses ───────── */

function render(filter) {

  if (filter !== undefined) activeFilter = filter;

  const cardsBox = document.getElementById('cards');
  const summaryView = document.getElementById('summary-view');

  if (activeFilter === 'summary') {
    cardsBox.classList.add('hidden');
    summaryView.classList.remove('hidden');
    cardsBox.innerHTML = '';
  } else {
    cardsBox.classList.remove('hidden');
    summaryView.classList.add('hidden');
    cardsBox.innerHTML = '';
  }

  const filtered = data.filter(c => {

    const tabMatch =
      activeFilter === 'all' ||
      (activeFilter === 'share' && c.type === 'Data Sharing');

    const riskMatch = activeRisks.has(c.risk);

    return tabMatch && riskMatch;
  });

  if (filtered.length === 0) {
    cardsBox.innerHTML =
      `<div class="empty-state">✅ No matching clauses found.</div>`;
    return;
  }

  filtered.forEach((c, i) => {

    const d = document.createElement('div');
    d.className = 'card';
    d.style.animationDelay = `${i * 45}ms`;

    const m = riskMeta[c.risk] || riskMeta.medium;

    const preview =
      c.text.length > 120
        ? c.text.substring(0, 120) + '...'
        : c.text;

    const hasMore = c.text.length > 120;

    const explanation = c.simple || "Explanation unavailable";

    d.innerHTML = `
      <div class="card-header">
        <span class="${m.cls}">${m.label}</span>
        <span class="card-type">${c.type}</span>
      </div>

      <div class="clause-preview">${preview}</div>

      ${hasMore
        ? `<div class="clause-full">${c.text}</div>
           <button class="toggle-btn">View More</button>`
        : ''
      }

      <div class="exp">${explanation}</div>
    `;

    cardsBox.appendChild(d);

    const toggleBtn = d.querySelector('.toggle-btn');

    if (toggleBtn) {

      toggleBtn.addEventListener('click', () => {

        const full = d.querySelector('.clause-full');
        const prev = d.querySelector('.clause-preview');

        const isHidden =
          window.getComputedStyle(full).display === 'none';

        if (isHidden) {

          full.style.display = 'block';
          prev.style.display = 'none';
          toggleBtn.textContent = 'View Less';

        } else {

          full.style.display = 'none';
          prev.style.display = 'block';
          toggleBtn.textContent = 'View More';

        }

      });

    }

  });

}

/* ───────── Analyze Button ───────── */

document.getElementById('analyze').onclick = async () => {

  const btn = document.getElementById('analyze');

  btn.classList.add('loading');
  btn.innerHTML = '⏳ Analyzing…';

  const [tab] =
    await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

  try {

    await chrome.tabs.sendMessage(
      tab.id,
      { action: 'analyze' }
    );

  } catch {

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    await new Promise(r => setTimeout(r, 200));

    await chrome.tabs.sendMessage(
      tab.id,
      { action: 'analyze' }
    );

  }

  const poll = setInterval(() => {

    chrome.storage.local.get(null, d => {

      if (d.score !== undefined || d.error) {

        clearInterval(poll);

        data = d.clauses || [];

        if (!d.score) {

          btn.classList.remove('loading');
          btn.innerHTML = '🔍 Analyze Policy';
          return;

        }

        const counts = {
          high: data.filter(c => c.risk === 'high').length,
          medium: data.filter(c => c.risk === 'medium').length,
          low: data.filter(c => c.risk === 'low').length
        };

        updateGauge(d.score);

        renderRiskChart(counts);

        generateSummary(
          counts,
          d.grade,
          d.privacyRiskPct
        );

        btn.classList.remove('loading');
        btn.innerHTML = '🔍 Analyze Policy';

        render('summary');

      }

    });

  }, 300);

};

/* ───────── Tabs ───────── */

document.getElementById('all').onclick =
  () => render('all');

document.getElementById('summary').onclick =
  () => render('summary');

document.getElementById('share').onclick =
  () => render('share');

/* ───────── Theme ───────── */

function initTheme() {

  const themeToggle =
    document.getElementById('theme-toggle');

  chrome.storage.local.get('theme', (result) => {

    if (result.theme === 'light') {
      document.body.classList.add('light-theme');
    }

  });

  if (themeToggle) {

    themeToggle.addEventListener('click', () => {

      const isLight =
        document.body.classList.toggle('light-theme');

      chrome.storage.local.set({
        theme: isLight ? 'light' : 'dark'
      });

    });

  }

}

document.addEventListener(
  'DOMContentLoaded',
  initTheme
);
