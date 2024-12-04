import { requestUrl } from 'obsidian';

export class OpenAIService {
    private static instance: OpenAIService;
    private apiKey: string;

    private constructor() {}

    public static getInstance(): OpenAIService {
        if (!OpenAIService.instance) {
            OpenAIService.instance = new OpenAIService();
        }
        return OpenAIService.instance;
    }

    public setApiKey(apiKey: string) {
        this.apiKey = apiKey;
    }

    public async reformatText(text: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not set');
        }

        const prompt = `Please reformat the following transcript to be more readable. 
        - Fix any formatting issues
        - Add proper punctuation
        - Break into logical paragraphs
        - Maintain the original meaning and content
        - Remove any unnecessary spaces or line breaks
        
        Transcript: ${text}`;

        try {
            const response = await requestUrl({
                url: 'https://api.openai.com/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.3
                })
            });

            const result = JSON.parse(response.text);
            return result.choices[0].message.content.trim();
        } catch (error) {
            console.error('Error reformatting text with OpenAI:', error);
            throw error;
        }
    }
} 