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

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.NVIDIA_API_KEY;

    if (!apiKey) {
        console.error('No API key found (tried GEMINI_API_KEY, API_KEY, NVIDIA_API_KEY)');
        return res.status(200).json({ 
            error: 'API_KEY_MISSING',
            explanations: clauses.map(() => null) 
        });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `You are a privacy policy expert specializing in legal simplification.
Generate a JSON object with a key "explanations" containing an array of exactly ${clauses.length} strings.

Rules:
1. Each string must be a one-sentence, plain-English summary of the corresponding clause.
2. Keep the responses concise but informative.
3. The array length MUST match the input count (${clauses.length}).
4. Return ONLY the JSON object.

Clauses to analyze:
${clauses.map((c, i) => `${i + 1}. ${c}`).join('\n\n')}`;

    const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
            temperature: 0.1, 
            maxOutputTokens: 4096,
            response_mime_type: "application/json"
        }
    });

    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            if (attempt > 0) {
                console.log(`[Backend] Retry attempt ${attempt}...`);
                await new Promise(r => setTimeout(r, 2000 * attempt));
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });

            const data = await response.json();

            if (!response.ok) {
                const errMsg = data?.error?.message || response.statusText || 'Unknown Gemini Error';
                console.error(`Gemini Error (${response.status}):`, errMsg);
                lastError = `Gemini_${response.status}: ${errMsg}`;
                if (response.status === 429) continue; // Retry on rate limit
                break; 
            }

            let text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!text) throw new Error("Empty response from Gemini");

            // Robust JSON parsing (handle markdown blocks if present)
            if (text.includes('```json')) {
                text = text.split('```json')[1].split('```')[0].trim();
            } else if (text.includes('```')) {
                text = text.split('```')[1].split('```')[0].trim();
            }

            const parsed = JSON.parse(text);
            const explanations = Array.isArray(parsed) ? parsed : (parsed.explanations || []);
            
            return res.status(200).json({ 
                success: true,
                explanations: clauses.map((_, i) => (typeof explanations[i] === 'string' && explanations[i].length > 5) ? explanations[i] : null) 
            });

        } catch (err) {
            console.error('[Backend] Request failed:', err.message);
            lastError = err.message;
        }
    }

    return res.status(200).json({ 
        error: lastError || 'UNKNOWN_BACKEND_ERROR',
        explanations: clauses.map(() => null) 
    });
}