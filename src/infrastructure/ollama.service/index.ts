const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3:mini';
const OLLAMA_TIMEOUT_MS = 180_000; // 3 minutes

interface OllamaGenerateResponse {
    response: string;
}

export class OllamaService {
    async explainStrategy(
        className: string,
        role: string,
        statPriority: string,
        bisContext: string,
    ): Promise<string | null> {
        const prompt = [
            `You are a World of Warcraft TBC Classic advisor writing a short Discord message.`,
            `The player is a **${className} ${role}**.`,
            ``,
            statPriority ? `Stat priority from community guides:\n${statPriority}\n` : '',
            bisContext ? `BIS items from community guides:\n${bisContext}\n` : '',
            `Write 2-3 sentences of gearing strategy advice for this ${className} ${role}.`,
            `Focus on: which stats to prioritize, which gear slots matter most, and any common gearing mistakes to avoid.`,
            bisContext ? `You may reference specific BIS items from the list above if relevant.` : '',
            ``,
            `Rules:`,
            `- Use Discord markdown: **bold** for important stats or keywords`,
            `- Keep the total response under 300 characters`,
            `- Be direct and specific to ${className} ${role}, not generic`,
        ].filter(Boolean).join('\n');

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: OLLAMA_MODEL,
                    prompt,
                    stream: false,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                console.error(`Ollama responded with status ${response.status}`);
                return null;
            }

            const data = await response.json() as OllamaGenerateResponse;
            return data.response?.trim() || null;
        } catch (error: any) {
            console.error(`Ollama call failed: ${error.message}`);
            return null;
        }
    }
}
