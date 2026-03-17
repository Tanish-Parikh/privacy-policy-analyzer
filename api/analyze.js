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
                        content: "Simplify privacy policy clauses into ONE short, clear sentence for normal users."
                    },
                    {
                        role: "user",
                        content: clause
                    }
                ],
                temperature: 0.3,
                max_tokens: 60
            })
        });

        const data = await response.json();

        console.log("GROQ RESPONSE:", data); // debug

        const text = data?.choices?.[0]?.message?.content?.trim();

        if (!text) {
            throw new Error("No AI response");
        }

        return res.status(200).json({
            explanation: text
        });

    } catch (err) {

        console.error("GROQ ERROR:", err);

        return res.status(200).json({
            explanation: "Could not simplify this clause."
        });

    }
}