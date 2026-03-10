// /api/analyze.js
import { NVIDIA_API_KEY } from '../config/apiKey.js';

export default async function handler(req, res) {

  /* ───────── CORS HEADERS ───────── */

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).send('ok');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clause } = req.body;

  if (!clause) {
    return res.status(400).json({ error: 'clause missing' });
  }

  /* ───────── PROMPT ───────── */

  const prompt = `You are a privacy policy analyzer.

Analyze the following clause and determine if it creates a privacy risk.

Return JSON in this format ONLY:

{
"type": "data-sharing | data-collection | functionality | safe",
"risk_level": "low | medium | high",
"explanation": "simple explanation"
}

Clause:
${clause}`;

  try {

    /* ───────── NVIDIA API CALL ───────── */

    const response = await fetch(
      "https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NVIDIA_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-8b-instruct",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 200
        })
      }
    );

    if (!response.ok) {

      const errorText = await response.text();

      console.error("NVIDIA API error:", errorText);

      throw new Error(`NVIDIA API responded with ${response.status}`);

    }

    const data = await response.json();

    console.log("NVIDIA raw response:", data);

    /* ───────── EXTRACT AI TEXT ───────── */

    const resultText =
      data?.choices?.[0]?.message?.content ||
      JSON.stringify(data);

    /* ───────── PARSE JSON FROM AI OUTPUT ───────── */

    const jsonMatch = resultText.match(/\{[\s\S]*?\}/);

    if (!jsonMatch) {
      throw new Error("Failed to parse JSON from AI response");
    }

    const parsedResult = JSON.parse(jsonMatch[0]);

    /* ───────── RETURN RESULT ───────── */

    return res.status(200).json(parsedResult);

  } catch (error) {

    console.error('AI analysis error:', error);

    return res.status(500).json({
      error: 'AI analysis failed'
    });

  }

}
