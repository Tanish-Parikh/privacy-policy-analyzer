export default async function handler(req, res) {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { clause } = req.body;

    if (!clause) {
        return res.status(400).json({ error: 'Missing clause' });
    }

    // Guard: check API key is configured
    if (!process.env.GROQ_API_KEY) {
        console.error('GROQ_API_KEY is not set in environment variables');
        return res.status(500).json({
            explanation: 'Could not simplify this clause.',
            error: 'API key not configured'
        });
    }

    try {

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
                        role: "system",
                        content: "You are a privacy policy simplifier. Rewrite privacy policy clauses into ONE clear, plain-English sentence that a normal person can understand. Be direct and specific about what data is collected or shared."
                    },
                    {
                        role: "user",
                        content: `Simplify this privacy policy clause in one sentence: ${clause}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 80
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error(`Groq API HTTP error ${response.status}:`, errBody);
            throw new Error(`Groq returned status ${response.status}: ${errBody}`);
        }

        const data = await response.json();

        console.log("GROQ RESPONSE:", JSON.stringify(data).slice(0, 200));

        const text = data?.choices?.[0]?.message?.content?.trim();

        if (!text) {
            throw new Error("Empty response from Groq");
        }

        return res.status(200).json({
            explanation: text
        });

    } catch (err) {

        console.error("GROQ ERROR:", err.message || err);

        return res.status(200).json({
            explanation: "Could not simplify this clause.",
            debug: process.env.NODE_ENV !== 'production' ? err.message : undefined
        });

    }
}