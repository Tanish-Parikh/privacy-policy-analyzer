export default async function handler(req, res) {

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { clause } = req.body;

        if (!clause) {
            return res.status(400).json({ error: 'No clause provided' });
        }

        // 🔥 AI CALL (Groq - free)
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    {
                        role: "user",
                        content: `Explain this privacy clause in ONE short, simple sentence (max 12 words): ${clause}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 50
            })
        });

        const data = await response.json();

        let explanation = data?.choices?.[0]?.message?.content;

        if (explanation) {
            explanation = explanation
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        // ✅ NEVER RETURN SAME STATIC TEXT
        if (!explanation || explanation.length < 5) {
            explanation = clause.split('. ')[0]; // dynamic fallback
        }

        return res.status(200).json({ explanation });

    } catch (err) {
        console.error("API ERROR:", err);

        // fallback if API fails
        return res.status(200).json({
            explanation: "This clause describes how your data may be used."
        });
    }
}