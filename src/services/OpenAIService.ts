import { requestUrl } from 'obsidian';
import type SkribePlugin from '../../main';

export class OpenAIService {
    private static instance: OpenAIService;
    private apiKey: string;
    private plugin: SkribePlugin;

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

    public setPlugin(plugin: SkribePlugin) {
        this.plugin = plugin;
    }

    public async reformatText(text: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not set');
        }

        const prompt = `Please analyze and reformat this transcript into a well-structured markdown document. Include:

1. A brief summary (2-3 sentences) at the top
2. Key points or takeaways as bullet points
3. The main transcript content below, reformatted with:
   - Proper paragraphs
   - Correct punctuation
   - Logical flow
   - Clear speaker transitions (if any)
   - Don't lose any information, especially including examples, quotes, or specific details.

Format the output as follows:

# Summary
[2-3 sentence summary]

## Key Points
- [key point 1]
- [key point 2]
etc.

## Transcript
[reformatted transcript content]

Here's the transcript to process: ${text}`;

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
                    model: this.plugin.settings.model,
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