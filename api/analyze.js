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
        return res.status(200).json({ error: 'API_KEY_MISSING', explanations: clauses.map(() => null) });
    }

    // Use ONLY gemini-2.5-flash as requested
    const configs = [
        { model: 'gemini-2.5-flash', version: 'v1beta' },
        { model: 'gemini-2.5-flash', version: 'v1' }
    ];
    
    let lastError = null;

    for (const config of configs) {
        const url = `https://generativelanguage.googleapis.com/${config.version}/models/${config.model}:generateContent?key=${apiKey}`;
        const prompt = `You are a privacy expert. Summarize these ${clauses.length} clauses in one sentence each. Return JSON: { "explanations": ["string", ...] }\n\nClauses:\n${clauses.map((c, i) => `${i + 1}. ${c}`).join('\n\n')}`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } })
            });

            const data = await response.json();

            if (response.status === 404) {
                lastError = `404: ${config.model} (${config.version})`;
                continue; // Try next config
            }

            if (response.status === 503 || response.status === 429) {
                console.warn(`Busy (${response.status}), waiting...`);
                await new Promise(r => setTimeout(r, 1000));
                // We'll let it move to the next model if this one is busy
                lastError = `Busy_${response.status}: ${config.model}`;
                continue;
            }

            if (!response.ok) {
                lastError = data?.error?.message || response.statusText;
                continue;
            }

            let text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!text) continue;

            const jsonMatch = text.match(/```json?\s*([\s\S]*?)\s*```/) || [null, text];
            const cleanText = jsonMatch[1].trim();
            const parsed = JSON.parse(cleanText);
            const rawExplanations = Array.isArray(parsed) ? parsed : (parsed.explanations || []);
            
            return res.status(200).json({ 
                success: true,
                model_used: `${config.model} (${config.version})`,
                explanations: clauses.map((_, i) => {
                    const item = rawExplanations[i];
                    if (typeof item === 'string') return item;
                    if (item && typeof item === 'object') return item.explanation || item.text || item.summary || JSON.stringify(item);
                    return null;
                })
            });

        } catch (err) {
            lastError = err.message;
        }
    }

    return res.status(200).json({ 
        error: `ALL_CONFIGS_FAILED: ${lastError}`,
        explanations: clauses.map(() => null) 
    });
}