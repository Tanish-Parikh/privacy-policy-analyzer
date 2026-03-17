export default async function handler(req, res) {

    // ✅ CORS (REQUIRED for Chrome extension)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only POST allowed
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {

        const { clause } = req.body;

        if (!clause) {
            return res.status(400).json({ error: 'clause missing' });
        }

        // 🔥 STRONG PROMPT (better output)
        const prompt = `
You are an expert privacy policy analyzer.

Explain the following clause in VERY SIMPLE language (like explaining to a normal user).

ONLY return the explanation. No JSON. No formatting.

Clause:
${clause}
`;

        // ✅ NVIDIA API CALL
        const response = await fetch(
            "https://api.nvcf.nvidia.com/v2/nvcf/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "meta/llama3-8b-instruct",
                    messages: [
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 100
                })
            }
        );

        const data = await response.json();

        // 🔍 DEBUG LOG (check in Vercel logs if needed)
        console.log("🔥 NVIDIA RAW:", JSON.stringify(data));

        // ✅ ROBUST PARSING
        let explanation = null;

        if (data?.choices && data.choices.length > 0) {
            const c = data.choices[0];

            explanation =
                c?.message?.content ||
                c?.delta?.content ||
                c?.text ||
                null;
        }

        // fallback formats
        if (!explanation && data?.output?.text) {
            explanation = data.output.text;
        }

        if (!explanation && data?.content) {
            explanation = data.content;
        }

        // 🔥 FINAL FALLBACK (NEVER EMPTY)
        if (!explanation) {
            explanation = `This clause means: ${clause.substring(0, 100)}...`;
        }

        // clean output
        explanation = explanation
            .replace(/\n/g, ' ')
            .replace(/["']/g, '')
            .trim();

        return res.status(200).json({
            explanation
        });

    } catch (err) {

        console.error("❌ API ERROR:", err);

        return res.status(500).json({
            error: "AI failed"
        });
    }
}