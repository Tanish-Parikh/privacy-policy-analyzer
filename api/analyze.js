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
        return res.status(500).json({ explanation: 'Could not simplify this clause.' });
    }

    try {

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are a privacy policy simplifier. Rewrite the following privacy policy clause into ONE clear, plain-English sentence that a normal person can understand. Be direct and specific about what data is collected or shared. Do not add any intro like "This clause means". Just write the simplified sentence.\n\nClause: ${clause}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 80
                }
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error(`Gemini API error ${response.status}:`, errBody);
            throw new Error(`Gemini returned ${response.status}`);
        }

        const data = await response.json();

        console.log('GEMINI RESPONSE:', JSON.stringify(data).slice(0, 200));

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!text) {
            throw new Error('Empty response from Gemini');
        }

        return res.status(200).json({ explanation: text });

    } catch (err) {

        console.error('GEMINI ERROR:', err.message || err);

        return res.status(200).json({ explanation: 'Could not simplify this clause.' });

    }
}