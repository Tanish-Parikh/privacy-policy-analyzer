// /api/analyze.js
import { NVIDIA_API_KEY } from '../config/apiKey.js';

export default async function handler(req, res) {

  /* ───────── ALWAYS SET CORS ───────── */

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  /* ───────── HANDLE PREFLIGHT ───────── */

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { clause } = req.body || {};

  if (!clause) {
    return res.status(400).json({ error: "clause missing" });
  }

  const prompt = `You are a privacy policy analyzer.

Analyze the following clause and determine if it creates a privacy risk.

Return JSON ONLY in this format:

{
"type": "data-sharing | data-collection | functionality | safe",
"risk_level": "low | medium | high",
"explanation": "simple explanation"
}

Clause:
${clause}`;

  try {

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
            { role: "user", content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 200
        })
      }
    );

    if (!response.ok) {
      const txt = await response.text();
      console.error("NVIDIA error:", txt);
      throw new Error("NVIDIA API error");
    }

    const data = await response.json();

    const resultText =
      data?.choices?.[0]?.message?.content ||
      JSON.stringify(data);

    const jsonMatch = resultText.match(/\{[\s\S]*?\}/);

    if (!jsonMatch) {
      throw new Error("AI JSON parse failed");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return res.status(200).json(parsed);

  } catch (error) {

    console.error("AI analysis error:", error);

    return res.status(500).json({
      error: "AI analysis failed"
    });

  }

}
