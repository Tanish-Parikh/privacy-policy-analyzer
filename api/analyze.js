export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clause } = req.body;

    if (!clause) {
      return res.status(400).json({ error: 'clause missing' });
    }

    const prompt = `
You are a privacy policy simplifier.

Convert the clause into ONE very simple sentence.

STRICT RULES:
- DO NOT repeat the clause
- DO NOT use words like "this clause"
- DO NOT summarize structure — explain meaning
- MUST sound like a human explanation
- MAX 15 words
- Output ONLY the sentence

Clause:
${clause}
`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 60
      })
    });

    const data = await response.json();

    let explanation = data?.choices?.[0]?.message?.content || "";

    // 🔥 HARD CLEAN (THIS IS THE FIX YOU WERE MISSING)
    explanation = explanation
      .replace(/^.*?:/g, '') // remove "Explanation:" etc
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 🚫 If model repeats clause → reject it
    if (
      explanation.length < 5 ||
      explanation.toLowerCase().includes(clause.substring(0, 30).toLowerCase())
    ) {
      explanation = "Your data may be used or shared based on this policy.";
    }

    return res.status(200).json({ explanation });

  } catch (err) {
    console.error("API ERROR:", err);
    return res.status(500).json({ error: "AI failed" });
  }
}