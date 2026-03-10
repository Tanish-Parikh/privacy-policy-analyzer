// api/analyze.js

export default async function handler(req, res) {

  // Allow browser extension requests (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clause } = req.body;

  if (!clause) {
    return res.status(400).json({ error: 'clause missing' });
  }

  // AI prompt
  const prompt = `You are a privacy policy analyzer.
Analyze the following clause and determine if it creates a privacy risk.

Return JSON in this format:

{
"type": "data-sharing | data-collection | functionality | safe",
"risk_level": "low | medium | high",
"explanation": "simple explanation"
}

Clause:
${clause}`;

  try {

    const response = await fetch('https://api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`
      },
      body: JSON.stringify({
        model: 'meta/llama3-8b-instruct',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      throw new Error(`NVIDIA API error: ${response.status}`);
    }

    const data = await response.json();

    const resultText = data.choices?.[0]?.message?.content || "";

    // Extract JSON from model output
    const jsonMatch = resultText.match(/\{[\s\S]*?\}/);

    if (!jsonMatch) {
      return res.status(200).json({
        type: "unknown",
        risk_level: "unknown",
        explanation: resultText
      });
    }

    const parsedResult = JSON.parse(jsonMatch[0]);

    return res.status(200).json(parsedResult);

  } catch (error) {

    console.error("AI analysis error:", error);

    return res.status(500).json({
      error: "AI analysis failed"
    });

  }
}
