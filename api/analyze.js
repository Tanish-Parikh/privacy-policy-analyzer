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
        console.error('No API key found');
        return res.status(200).json({ 
            error: 'API_KEY_MISSING',
            explanations: clauses.map(() => null) 
        });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `You are a privacy policy expert. Analyze these ${clauses.length} clauses and provide a one-sentence, plain-English summary for each.
Return the results as a JSON object with an "explanations" key containing an array of ${clauses.length} strings.

Clauses:
${clauses.map((c, i) => `${i + 1}. ${c}`).join('\n\n')}`;

    const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
            temperature: 0.1, 
            maxOutputTokens: 4096
        }
    });

    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });

            const data = await response.json();

            if (!response.ok) {
                const errMsg = data?.error?.message || response.statusText || 'Gemini Error';
                lastError = `Gemini_${response.status}: ${errMsg}`;
                if (response.status === 429) {
                    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                    continue;
                }
                break; 
            }

            let text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!text) throw new Error("Empty AI response");

            // Extract JSON from potential markdown blocks
            const jsonMatch = text.match(/```json?\s*([\s\S]*?)\s*```/) || [null, text];
            const cleanText = jsonMatch[1].trim();

            const parsed = JSON.parse(cleanText);
            const rawExplanations = Array.isArray(parsed) ? parsed : (parsed.explanations || []);
            
            const evaluations = clauses.map((_, i) => {
                const item = rawExplanations[i];
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object') return item.explanation || item.text || item.summary || JSON.stringify(item);
                return null;
            });

            return res.status(200).json({ 
                success: true,
                explanations: evaluations 
            });

        } catch (err) {
            console.error('[Backend] Error:', err.message);
            lastError = err.message;
        }
    }

    return res.status(200).json({ 
        error: lastError || 'UNKNOWN_ERROR',
        explanations: clauses.map(() => null) 
    });
}