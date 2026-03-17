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
Explain this privacy policy clause in very simple language in ONE short sentence:

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
                messages: [
                    { role: "user", content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 100
            })
        });

        const data = await response.json();

        console.log("🔥 GROQ:", data);

        let explanation =
            data?.choices?.[0]?.message?.content ||
            "This clause explains how your data is used.";

        explanation = explanation
            .replace(/\n/g, ' ')
            .replace(/["']/g, '')
            .trim();

        return res.status(200).json({ explanation });

    } catch (err) {

        console.error("❌ API ERROR:", err);

        return res.status(500).json({
            error: "AI failed"
        });
    }
}