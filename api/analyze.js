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
        console.error('GEMINI_API_KEY is not set');
        return res.status(500).json({ explanation: 'Could not simplify this clause.' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const body = JSON.stringify({
        contents: [{
            parts: [{
                text: `Rewrite the following privacy policy clause into ONE clear, plain-English sentence. Be direct about what data is collected or shared.\n\nClause: ${clause}`
            }]
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 80 }
    });

    // Retry up to 3 times with backoff on rate limit errors
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            if (attempt > 0) {
                // Wait 1.5s on first retry, 3s on second
                await new Promise(r => setTimeout(r, 1500 * attempt));
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });

            // On rate limit, retry
            if (response.status === 429) {
                console.warn(`Gemini 429 on attempt ${attempt + 1}, retrying...`);
                continue;
            }

            if (!response.ok) {
                const errText = await response.text();
                console.error(`Gemini ${response.status}:`, errText);
                return res.status(200).json({ explanation: 'Could not simplify this clause.' });
            }

            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (!text) {
                return res.status(200).json({ explanation: 'Could not simplify this clause.' });
            }

            return res.status(200).json({ explanation: text });

        } catch (err) {
            console.error(`Attempt ${attempt + 1} error:`, err.message);
            if (attempt === 2) {
                return res.status(200).json({ explanation: 'Could not simplify this clause.' });
            }
        }
    }

    // All retries exhausted
    return res.status(200).json({ explanation: 'Could not simplify this clause.' });
}