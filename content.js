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

  // Extract text from paragraphs and lists
  const rawElements = Array.from(container.querySelectorAll('p, li'));
  const textBlocks = rawElements
    .map(el => el.innerText.trim())
    .filter(t => t.length > 20); // only substantial paragraphs

  const allText = textBlocks.join(' ');

  // Split into sentences using a regex that looks for end-of-sentence punctuation
  const sentences = allText.match(/[^.!?]+[.!?]+/g) || [];

  // Clean up and filter out short or overly long clauses
  return sentences
    .map(c => c.trim())
    .filter(c => c.length > 20 && c.length < 500);
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyze') {
    const clauses = extractClauses();
    sendResponse({ clauses });
  }
  return true; // Indicates async response
});
