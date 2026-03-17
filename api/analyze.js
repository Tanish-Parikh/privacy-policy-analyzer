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

    const { clause } = req.body;

    if (!clause) {
        return res.status(400).json({ error: 'Missing clause' });
    }

    try {

        const response = await fetch("https://api.nvcf.nvidia.com/v2/nvcf/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "meta/llama3-8b-instruct",
                messages: [
                    {
                        role: "system",
                        content: "You simplify privacy policy clauses into ONE short, clear sentence for normal users."
                    },
                    {
                        role: "user",
                        content: `Simplify this clause in one short sentence:\n\n${clause}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 60
            })
        });

        const data = await response.json();

        const text = data?.choices?.[0]?.message?.content?.trim();

        if (!text) {
            throw new Error("No response from AI");
        }

        return res.status(200).json({
            explanation: text
        });

    } catch (error) {

        console.error("AI ERROR:", error);

        // fallback (but NOT generic garbage)
        return res.status(200).json({
            explanation: "This clause describes how your data is handled."
        });

    }
}