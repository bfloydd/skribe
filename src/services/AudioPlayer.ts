import { Notice } from 'obsidian';
import { OpenAIService } from './OpenAIService';

export class AudioPlayer {
    private utterance: SpeechSynthesisUtterance;
    private openAIService: OpenAIService;
    private isPlaying: boolean = false;
    private audioElement: HTMLAudioElement | null = null;
    private switchTimeout: NodeJS.Timeout | null = null;
    private readonly SWITCH_TIME = 15000; // 15 seconds
    private readonly WORDS_PER_MINUTE = 150;
    private readonly MAX_CHUNK_LENGTH = 1000;

    constructor(openAIKey: string, private onStateChange: (isPlaying: boolean) => void, openAIService: OpenAIService) {
        this.openAIService = openAIService;
        this.utterance = new SpeechSynthesisUtterance();
    }

    private splitTextAtTime(text: string, seconds: number): { initial: string, remaining: string } {
        const wordsForTime = Math.floor((this.WORDS_PER_MINUTE / 60) * seconds);
        const words = text.split(' ');
        return {
            initial: words.slice(0, wordsForTime).join(' '),
            remaining: words.slice(wordsForTime).join(' ')
        };
    }

    private chunkText(text: string): string[] {
        const chunks: string[] = [];
        // Split into sentences first
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        
        let currentChunk = '';
        for (const sentence of sentences) {
            // If sentence itself is too long, split it further
            if (sentence.length > this.MAX_CHUNK_LENGTH) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                    currentChunk = '';
                }
                // Split long sentence by commas or natural breaks
                const subParts = sentence.split(/([,;])/);
                for (const part of subParts) {
                    if ((currentChunk + part).length > this.MAX_CHUNK_LENGTH) {
                        if (currentChunk) chunks.push(currentChunk.trim());
                        currentChunk = part;
                    } else {
                        currentChunk += part;
                    }
                }
            } else if ((currentChunk + sentence).length > this.MAX_CHUNK_LENGTH) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += sentence;
            }
        }
        
        if (currentChunk) chunks.push(currentChunk.trim());
        return chunks.filter(chunk => chunk.length > 0);
    }

    private async playChunks(chunks: string[]): Promise<void> {
        for (const chunk of chunks) {
            if (!this.isPlaying) break;
            
            try {
                const audioBuffer = await this.openAIService.textToSpeech(chunk);
                const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
                const url = URL.createObjectURL(blob);
                
                this.audioElement = new Audio(url);
                this.audioElement.onended = () => {
                    URL.revokeObjectURL(url);
                };
                
                await this.audioElement.play();
                // Wait for chunk to finish playing
                await new Promise(resolve => {
                    this.audioElement!.onended = () => {
                        URL.revokeObjectURL(url);
                        resolve(null);
                    };
                });
            } catch (error) {
                console.error('Error playing chunk:', error);
                throw error;
            }
        }
    }

    public async playText(text: string) {
        if (this.isPlaying) {
            this.stop();
            return;
        }

        this.isPlaying = true;
        const { initial, remaining } = this.splitTextAtTime(text, 10);

        // Start with browser speech
        this.utterance = new SpeechSynthesisUtterance(initial);
        this.utterance.rate = 1.2;
        
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => 
            voice.name.toLowerCase().includes('microsoft') || 
            voice.name.toLowerCase().includes('google')
        );
        if (preferredVoice) {
            this.utterance.voice = preferredVoice;
        }

        window.speechSynthesis.speak(this.utterance);
        this.onStateChange(true);

        // Switch to OpenAI after 10 seconds
        this.switchTimeout = setTimeout(async () => {
            if (this.isPlaying) {
                window.speechSynthesis.cancel();
                try {
                    const chunks = this.chunkText(remaining);
                    await this.playChunks(chunks);
                    this.stop();
                } catch (error) {
                    console.error('Error switching to OpenAI voice:', error);
                    new Notice('Error switching to OpenAI voice');
                    this.stop();
                }
            }
        }, this.SWITCH_TIME);
    }

    public togglePlayPause() {
        if (!this.isPlaying) {
            if (this.audioElement) {
                this.audioElement.play();
            } else {
                window.speechSynthesis.resume();
            }
            this.onStateChange(true);
        } else {
            if (this.audioElement) {
                this.audioElement.pause();
            } else {
                window.speechSynthesis.pause();
            }
            this.onStateChange(false);
        }
        this.isPlaying = !this.isPlaying;
    }

    public stop() {
        if (this.switchTimeout) {
            clearTimeout(this.switchTimeout);
            this.switchTimeout = null;
        }
        window.speechSynthesis.cancel();
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement = null;
        }
        this.isPlaying = false;
        this.onStateChange(false);
    }
} 