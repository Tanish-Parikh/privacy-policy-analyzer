export default async function handler(req, res) {
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
Rewrite this privacy policy clause into ONE simple, clear sentence.

Rules:
- Do NOT repeat the clause
- Do NOT say "this clause means"
- Make it easy for a normal user
- Keep it short and understandable
- Return only the rewritten sentence

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
                messages: [
                    { role: "user", content: prompt }
                ],
                temperature: 0.2,
                max_tokens: 80
            })
        });

        const data = await response.json();

        let explanation =
            data?.choices?.[0]?.message?.content ||
            null;

        if (explanation) {
            explanation = explanation
                .replace(/^this clause means[:\s-]*/i, '')
                .replace(/^this means[:\s-]*/i, '')
                .replace(/^in simple terms[:,\s-]*/i, '')
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        if (!explanation) {
            explanation = clause.substring(0, 100) + "...";
        }

        return res.status(200).json({ explanation });
    } catch (err) {
        console.error("API ERROR:", err);
        return res.status(500).json({ error: "AI failed" });
    }
}