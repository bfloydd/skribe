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
        this.apiKey = apiKey?.trim() || '';
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
            console.log('Making OpenAI API request...');
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

            if (response.status !== 200) {
                console.error('OpenAI API Error:', {
                    status: response.status,
                    statusText: response.status,
                    response: response.text
                });
                throw new Error(`OpenAI API Error: ${response.status} - ${response.text}`);
            }

            const result = JSON.parse(response.text);
            if (!result.choices?.[0]?.message?.content) {
                console.error('Unexpected API response format:', result);
                throw new Error('Unexpected API response format');
            }

            return result.choices[0].message.content.trim();
        } catch (error) {
            console.error('Error details:', {
                message: error.message,
                status: error.status,
                response: error.response?.text
            });
            
            if (error.status === 401) {
                throw new Error('Invalid OpenAI API key. Please check your API key in settings.');
            } else if (error.status === 429) {
                throw new Error('OpenAI API rate limit exceeded. Please try again later.');
            } else {
                throw new Error(`OpenAI API Error: ${error.message}`);
            }
        }
    }
} 