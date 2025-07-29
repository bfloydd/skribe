import { requestUrl, Notice } from 'obsidian';
import type SkribePlugin from '../../main';
import { ChatMessage } from '../types/index';

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

    /**
     * Estimate the number of tokens in a text string
     * This is a rough approximation: ~4 characters per token for English text
     */
    public estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    /**
     * Get the maximum context length for the current model
     */
    public getMaxContextLength(): number {
        const model = this.plugin.settings.model;
        switch (model) {
            case 'gpt-4o':
                return 128000; // 128k tokens
            case 'gpt-4o-mini':
                return 128000; // 128k tokens
            case 'gpt-4-turbo':
                return 128000; // 128k tokens
            case 'gpt-4-1106-preview':
                return 128000; // 128k tokens
            case 'gpt-4-0125-preview':
                return 128000; // 128k tokens
            case 'gpt-4':
                return 8192; // 8k tokens
            case 'gpt-3.5-turbo':
                return 4096; // 4k tokens
            default:
                return 128000; // Default to GPT-4o limit
        }
    }

    public async reformatText(content: string): Promise<string> {
        if (!this.apiKey) {
            console.error('OpenAIService: API key not set');
            throw new Error('OpenAI API key not set');
        }
        
        console.log('OpenAIService: Starting to reformat text');
        console.log('OpenAIService: Original content length:', content.length);
        
        // Truncate content if it exceeds the maximum length setting
        const maxLength = this.plugin.settings.maxTranscriptLength || 50000;
        let truncatedContent = content;
        let wasTruncated = false;
        
        if (content.length > maxLength) {
            truncatedContent = content.substring(0, maxLength);
            wasTruncated = true;
            console.log(`OpenAIService: Content truncated from ${content.length} to ${truncatedContent.length} characters`);
            
            // Show a notice to the user about truncation with settings link
            if (this.plugin) {
                const notice = new Notice(`Transcript truncated from ${content.length.toLocaleString()} to ${truncatedContent.length.toLocaleString()} characters. Click to adjust settings.`, 10000);
                
                // Add click handler to open settings
                notice.noticeEl.addEventListener('click', () => {
                    (this.plugin.app as any).setting?.open();
                    (this.plugin.app as any).setting?.openTabById('skribe');
                });
                
                // Add hover effect to indicate it's clickable
                notice.noticeEl.style.cursor = 'pointer';
                notice.noticeEl.style.textDecoration = 'underline';
            }
        }
        
        try {
            // Make sure we're using a prompt that will work well
            const prompt = `Please analyze and provide a concise summary of the following transcript. 
            Include key points, insights, and important information in a well-structured format with headings:
            ${wasTruncated ? '\n\n[Note: This transcript was truncated due to length limits]' : ''}

            ${truncatedContent}`;
            
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
                        model: this.plugin.settings.model,
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

    public async chatWithTranscript(messages: ChatMessage[], transcript: string, videoTitle?: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not set');
        }

        console.log('OpenAIService: Starting chat with transcript');
        console.log('OpenAIService: Original transcript length:', transcript.length);

        // Truncate transcript if it exceeds the maximum length setting
        const maxLength = this.plugin.settings.maxTranscriptLength || 50000;
        let truncatedTranscript = transcript;
        let wasTruncated = false;
        
        if (transcript.length > maxLength) {
            truncatedTranscript = transcript.substring(0, maxLength);
            wasTruncated = true;
            console.log(`OpenAIService: Transcript truncated from ${transcript.length} to ${truncatedTranscript.length} characters`);
            
            // Show a notice to the user about truncation with settings link
            if (this.plugin) {
                const notice = new Notice(`Transcript truncated from ${transcript.length.toLocaleString()} to ${truncatedTranscript.length.toLocaleString()} characters. Click to adjust settings.`, 10000);
                
                // Add click handler to open settings
                notice.noticeEl.addEventListener('click', () => {
                    (this.plugin.app as any).setting?.open();
                    (this.plugin.app as any).setting?.openTabById('skribe');
                });
                
                // Add hover effect to indicate it's clickable
                notice.noticeEl.style.cursor = 'pointer';
                notice.noticeEl.style.textDecoration = 'underline';
            }
        }

        const systemMessage = {
            role: "system",
            content: `You are a helpful assistant analyzing a video transcript. 
            Use the following transcript as context for answering the user's questions.
            ${videoTitle ? `Video Title: ${videoTitle}\n` : ''}${wasTruncated ? '[Note: This transcript was truncated due to length limits]\n' : ''}Transcript: ${truncatedTranscript}`
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
            } else if (error.message && error.message.includes('NetworkError')) {
                throw new Error('Network error or timeout. Please check your internet connection and try again.');
            } else {
                throw new Error(`OpenAI API Error: ${error.message}`);
            }
        }
    }

    /**
     * Create a revised version of the transcript with better grammar and formatting
     */
    public async createRevisedTranscript(content: string): Promise<string> {
        if (!this.apiKey) {
            console.error('OpenAIService: API key not set');
            throw new Error('OpenAI API key not set');
        }
        
        console.log('OpenAIService: Creating revised transcript');
        console.log('OpenAIService: Original content length:', content.length);
        
        // Truncate content if it exceeds the maximum length setting
        const maxLength = this.plugin.settings.maxTranscriptLength || 50000;
        let truncatedContent = content;
        let wasTruncated = false;
        
        if (content.length > maxLength) {
            truncatedContent = content.substring(0, maxLength);
            wasTruncated = true;
            console.log(`OpenAIService: Content truncated from ${content.length} to ${truncatedContent.length} characters`);
            
            // Show a notice to the user about truncation with settings link
            if (this.plugin) {
                const notice = new Notice(`Transcript truncated from ${content.length.toLocaleString()} to ${truncatedContent.length.toLocaleString()} characters. Click to adjust settings.`, 10000);
                
                // Add click handler to open settings
                notice.noticeEl.addEventListener('click', () => {
                    (this.plugin.app as any).setting?.open();
                    (this.plugin.app as any).setting?.openTabById('skribe');
                });
                
                // Add hover effect to indicate it's clickable
                notice.noticeEl.style.cursor = 'pointer';
                notice.noticeEl.style.textDecoration = 'underline';
            }
        }
        
        try {
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
                        model: this.plugin.settings.model,
                        messages: [
                            {
                                role: "system",
                                content: `You are an expert editor. Your task is to improve the following transcript by:
                                1. Fixing grammar, punctuation, and spelling errors
                                2. Creating proper paragraphs with logical breaks
                                3. Removing filler words, stutters, and repetitions
                                4. Maintaining the original meaning and information
                                5. Preserving important terminology
                                6. Making the text more readable and polished
                                
                                DO NOT add any new information or change the meaning of the content.
                                DO NOT add summaries, titles, or annotations.
                                DO NOT introduce facts that aren't in the original transcript.
                                DO focus on creating a clean, grammatically correct, and well-formatted version of the original.
                                ${wasTruncated ? '\n\n[Note: This transcript was truncated due to length limits]' : ''}`
                            },
                            {
                                role: "user",
                                content: truncatedContent
                            }
                        ],
                        temperature: 0.3
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
                    const revisedText = result.choices[0].message.content;
                    console.log('OpenAIService: Revised text length:', revisedText?.length);
                    
                    if (!revisedText) {
                        console.error('OpenAIService: Empty response from OpenAI');
                        throw new Error('Received empty response from OpenAI');
                    }
                    
                    // Ensure we have a valid string to return
                    return revisedText;
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
            console.error('Error in createRevisedTranscript:', error);
            throw error;
        }
    }
} 