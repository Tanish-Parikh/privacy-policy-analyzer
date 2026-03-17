export default async function handler(req, res) {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { clause } = req.body;

        const prompt = `
Rewrite this privacy clause into ONE simple sentence.

Rules:
- Use plain English
- Do NOT repeat wording
- Keep it short
- Max 12 words

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
                temperature: 0.2,
                max_tokens: 60
            })
        });

        const data = await response.json();

        let explanation =
            data?.choices?.[0]?.message?.content?.trim();

        // 🧠 CLEAN OUTPUT
        explanation = explanation
            ?.replace(/\n/g, ' ')
            ?.replace(/\s+/g, ' ')
            ?.trim();

        return res.status(200).json({
            explanation: explanation || null
        });

    } catch (err) {
        return res.status(500).json({ error: "AI failed" });
    }
}