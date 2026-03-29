export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { clauses } = req.body;
    if (!clauses || !Array.isArray(clauses) || clauses.length === 0) {
        return res.status(400).json({ error: 'Missing or invalid clauses array' });
    }

    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set');
        return res.status(500).json({ explanations: clauses.map(() => null) });
    }

    // Switch to 1.5-flash for better stability/limits on free tier
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const prompt = `You are a privacy policy expert. Rewrite each of the following privacy policy clauses into ONE clear, plain-English sentence. Be direct about what data is collected or shared.
Return ONLY a valid JSON array of strings, one string per clause, in the same order. No extra text, no markdown.

Clauses:
${clauses.map((c, i) => `${i + 1}. ${c}`).join('\n\n')}`;

    const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
    });

    // Server-side retry logic with exponential backoff
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            if (attempt > 0) {
                console.log(`[Backend] Retry attempt ${attempt}...`);
                await new Promise(r => setTimeout(r, 2000 * attempt)); // Wait 2s, then 4s
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });

            if (response.status === 429) {
                lastError = "Rate limit exceeded (429)";
                continue; // Try again
            }

            if (!response.ok) {
                const errText = await response.text();
                console.error(`Gemini Error (${response.status}):`, errText);
                return res.status(200).json({ explanations: clauses.map(() => null) });
            }

            const data = await response.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (!rawText) return res.status(200).json({ explanations: clauses.map(() => null) });

            const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
            const explanations = JSON.parse(jsonText);
            
            return res.status(200).json({ 
                explanations: clauses.map((_, i) => (typeof explanations[i] === 'string' && explanations[i].length > 5) ? explanations[i] : null) 
            });

        } catch (err) {
            console.error('[Backend] Request failed:', err.message);
            lastError = err.message;
        }
    }

    // If we get here, all retries failed
    return res.status(200).json({ 
        error: lastError,
        explanations: clauses.map(() => null) 
    });
}