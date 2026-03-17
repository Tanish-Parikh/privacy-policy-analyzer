export default async function handler(req, res) {

    // CORS
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
You are an AI Privacy Policy Analyzer.

Your job:
1. Check if this is a real privacy clause.
2. If yes:
   - classify type: data collection / sharing / retention / security / rights / general
   - assign risk: low / medium / high
   - explain simply in one sentence

3. If not meaningful:
   return:
   type = "irrelevant"
   risk = "low"
   explanation = "Not a meaningful clause"

Return ONLY JSON:

{
  "type": "...",
  "risk": "...",
  "explanation": "..."
}

Text:
${clause}
`;

        // ✅ GROQ API (NOT NVIDIA)
        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama3-8b-8192",
                    messages: [
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 200
                })
            }
        );

        const data = await response.json();

        console.log("🔥 GROQ RAW:", JSON.stringify(data));

        // ✅ default fallback
        let result = {
            type: "general",
            risk: "low",
            explanation: `This clause means: ${clause.substring(0, 80)}...`
        };

        try {

            let content =
                data?.choices?.[0]?.message?.content || "";

            const jsonMatch = content.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            }

        } catch (e) {
            console.log("⚠️ parsing failed");
        }

        // clean text
        if (result.explanation) {
            result.explanation = result.explanation
                .replace(/\n/g, ' ')
                .replace(/["']/g, '')
                .trim();
        }

        return res.status(200).json(result);

    } catch (err) {

        console.error("❌ API ERROR:", err);

        return res.status(500).json({
            error: "AI failed"
        });
    }
}