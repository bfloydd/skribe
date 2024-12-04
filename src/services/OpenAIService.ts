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

        // const prompt = `Please reformat the following transcript to be more readable. 
        // - Fix any formatting issues
        // - Add proper punctuation
        // - Break into logical paragraphs
        // - Maintain the original meaning and content
        // - Remove any unnecessary spaces or line breaks
        
        // Transcript: ${text}`;


        const prompt = `- Act like a grammar expert and reformat the following to be more readable. 
        - Group related ideas into longer paragraphs while fixing run-on sentences without changing the meaning.
        - Add proper punctuation. 
        
        ${text}`;

        //- Fix run-on sentences without changing the meaning, grouping related ideas into logical paragraphs.
        // - Remove any unnecessary spaces or line breaks. 
        // - Maintain the original meaning and content. 
        // - Fix run - on sentences without changing the meaning.
        // 
        // const prompt = `Act like a grammar expert and fix for punctuation. Intuit where sentences are missing periods and add them, then correcting the punctuation. Look for run-on sentences and them them more readable, while keeping the original meaning. Never change the meaning or the general length of the input, just fix the punctuation to make it more readable. 
        
        // ${text}`;

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
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 1
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