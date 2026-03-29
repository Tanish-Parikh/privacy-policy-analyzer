export default async function handler(req, res) {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Accept a single clause (legacy) or an array of clauses (batch)
    const { clauses } = req.body;

    if (!clauses || !Array.isArray(clauses) || clauses.length === 0) {
        return res.status(400).json({ error: 'Missing or invalid clauses array' });
    }

    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set');
        return res.status(500).json({ explanations: clauses.map(() => null) });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    // Build a single prompt that simplifies ALL clauses at once
    const numberedClauses = clauses
        .map((c, i) => `${i + 1}. ${c}`)
        .join('\n\n');

    const prompt = `You are a privacy policy expert. Rewrite each of the following privacy policy clauses into ONE clear, plain-English sentence. Be direct about what data is collected or shared.

Return ONLY a valid JSON array of strings, one string per clause, in the same order. No extra text, no markdown, just the JSON array.

Clauses:
${numberedClauses}`;

    const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 600 }
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });

        if (response.status === 429) {
            console.warn('Gemini 429 rate limit hit on batch request');
            return res.status(429).json({ error: 'Rate limit exceeded' });
        }

        if (!response.ok) {
            const errText = await response.text();
            console.error(`Gemini ${response.status}:`, errText);
            return res.status(200).json({ explanations: clauses.map(() => null) });
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!rawText) {
            return res.status(200).json({ explanations: clauses.map(() => null) });
        }

        // Strip markdown code fences if present
        const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

        let explanations;
        try {
            explanations = JSON.parse(jsonText);
            if (!Array.isArray(explanations)) throw new Error('Not an array');
        } catch (e) {
            console.error('Failed to parse Gemini JSON response:', rawText);
            return res.status(200).json({ explanations: clauses.map(() => null) });
        }

        // Ensure we return exactly as many explanations as clauses
        const result = clauses.map((_, i) =>
            typeof explanations[i] === 'string' && explanations[i].length > 5
                ? explanations[i]
                : null
        );

        return res.status(200).json({ explanations: result });

    } catch (err) {
        console.error('Batch request error:', err.message);
        return res.status(200).json({ explanations: clauses.map(() => null) });
    }
}