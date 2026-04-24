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

    // List of models to try in order
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-pro'];
    
    let lastError = null;

    for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const prompt = `You are a privacy expert. Provide a one-sentence summary for each of these ${clauses.length} clauses. Return JSON: { "explanations": ["string", ...] }\n\nClauses:\n${clauses.map((c, i) => `${i + 1}. ${c}`).join('\n\n')}`;
        
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } })
                });

                const data = await response.json();

                if (response.status === 503 || response.status === 429) {
                    console.warn(`Model ${model} busy (${response.status}), retrying...`);
                    await new Promise(r => setTimeout(r, 1500));
                    continue;
                }

                if (response.status === 404) {
                    lastError = `404: ${model}`;
                    break; // Try next model
                }

                if (!response.ok) {
                    const errMsg = data?.error?.message || response.statusText || 'AI Error';
                    lastError = `Gemini_${response.status}: ${errMsg}`;
                    break; // Try next model
                }

                let text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                if (!text) throw new Error("Empty AI response");

                const jsonMatch = text.match(/```json?\s*([\s\S]*?)\s*```/) || [null, text];
                const cleanText = jsonMatch[1].trim();
                const parsed = JSON.parse(cleanText);
                const rawExplanations = Array.isArray(parsed) ? parsed : (parsed.explanations || []);
                
                return res.status(200).json({ 
                    success: true,
                    model_used: model,
                    explanations: clauses.map((_, i) => {
                        const item = rawExplanations[i];
                        if (typeof item === 'string') return item;
                        if (item && typeof item === 'object') return item.explanation || item.text || item.summary || JSON.stringify(item);
                        return null;
                    })
                });

            } catch (err) {
                console.error(`Attempt with ${model} failed:`, err.message);
                lastError = err.message;
            }
        }
    }

    return res.status(200).json({ 
        error: `ALL_MODELS_FAILED: ${lastError}`,
        explanations: clauses.map(() => null) 
    });
}