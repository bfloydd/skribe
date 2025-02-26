import { requestUrl } from 'obsidian';
import type SkribePlugin from '../../main';
import { ChatMessage } from '../types';

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

    public async reformatText(content: string): Promise<string> {
        if (!this.apiKey) {
            console.error('OpenAIService: API key not set');
            throw new Error('OpenAI API key not set');
        }
        
        console.log('OpenAIService: Starting to reformat text');
        console.log('OpenAIService: Content length:', content.length);
        
        try {
            // Make sure we're using a prompt that will work well
            const prompt = `Please analyze and provide a concise summary of the following transcript. 
            Include key points, insights, and important information in a well-structured format with headings:

            ${content}`;
            
            console.log('OpenAIService: Sending request to OpenAI');
            
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
                                role: "system",
                                content: "You are an AI assistant that creates concise, well-structured summaries of transcripts."
                            },
                            {
                                role: "user",
                                content: prompt
                            }
                        ],
                        temperature: 0.5
                    })
                });
                
                console.log('OpenAIService: Received response from OpenAI', {
                    status: response.status,
                    statusText: response.status,
                    responseLength: response.text?.length
                });
                
                if (response.status !== 200) {
                    console.error('OpenAIService: API Error', {
                        status: response.status,
                        statusText: response.status,
                        response: response.text
                    });
                    throw new Error(`OpenAI API Error: ${response.status} - ${response.text}`);
                }
                
                const result = JSON.parse(response.text);
                if (result.choices && result.choices.length > 0) {
                    const formattedText = result.choices[0].message.content;
                    console.log('OpenAIService: Formatted text length:', formattedText?.length);
                    
                    if (!formattedText) {
                        console.error('OpenAIService: Empty response from OpenAI');
                        throw new Error('Received empty response from OpenAI');
                    }
                    
                    // Ensure we have a valid string to return
                    return formattedText;
                } else {
                    console.error('OpenAIService: No valid choices in response', result);
                    throw new Error('No valid response from OpenAI');
                }
            } catch (requestError) {
                console.error('OpenAIService: Request error', requestError);
                
                if (requestError.status === 401) {
                    throw new Error('Invalid OpenAI API key. Please check your API key in settings.');
                } else if (requestError.status === 429) {
                    throw new Error('OpenAI API rate limit exceeded. Please try again later.');
                } else {
                    throw new Error(`OpenAI API Error: ${requestError.message || 'Unknown error'}`);
                }
            }
        } catch (error) {
            console.error('Error in reformatText:', error);
            throw error;
        }
    }

    public async textToSpeech(text: string): Promise<ArrayBuffer> {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not set');
        }

        const response = await requestUrl({
            url: 'https://api.openai.com/v1/audio/speech',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: text,
                voice: this.plugin.settings.voice
            })
        });

        if (response.status !== 200) {
            throw new Error(`OpenAI API Error: ${response.status}`);
        }

        return response.arrayBuffer;
    }

    public async chatWithTranscript(messages: ChatMessage[], transcript: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not set');
        }

        const systemMessage = {
            role: "system",
            content: `You are a helpful assistant analyzing a video transcript. 
            Use the following transcript as context for answering the user's questions.
            Transcript: ${transcript}`
        };

        try {
            console.log('Making OpenAI API chat request...');
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
                        systemMessage,
                        ...messages
                    ],
                    temperature: 0.7
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