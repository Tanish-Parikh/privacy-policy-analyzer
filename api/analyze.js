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

    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set in environment variables');
        return res.status(500).json({ explanation: '[Debug] API key missing on server.' });
    }

    try {

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Rewrite the following privacy policy clause into ONE clear, plain-English sentence. Be direct about what data is collected or shared.\n\nClause: ${clause}`
                    }]
                }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 80 }
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error(`Gemini API error ${response.status}:`, errBody);
            return res.status(200).json({ explanation: `[Debug] Gemini HTTP ${response.status}` });
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!text) {
            return res.status(200).json({ explanation: '[Debug] Gemini returned empty response.' });
        }

        return res.status(200).json({ explanation: text });

    } catch (err) {

        console.error('GEMINI ERROR:', err.message || err);
        return res.status(200).json({ explanation: `[Debug] Fetch error: ${err.message}` });

    }
}