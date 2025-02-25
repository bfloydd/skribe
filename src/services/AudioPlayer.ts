import { Notice } from 'obsidian';
import { OpenAIService } from './OpenAIService';
import { EventEmitter } from './EventEmitter';

export class AudioPlayer extends EventEmitter {
    private openAIService: OpenAIService;
    private isPlaying: boolean = false;
    private audioElement: HTMLAudioElement | null = null;
    private readonly MAX_CHUNK_LENGTH = 1000;

    constructor(openAIKey: string, private onStateChange: (isPlaying: boolean) => void, openAIService: OpenAIService) {
        super();
        this.openAIService = openAIService;
    }

    private chunkText(text: string): string[] {
        const chunks: string[] = [];
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        
        let currentChunk = '';
        for (const sentence of sentences) {
            if (sentence.length > this.MAX_CHUNK_LENGTH) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                    currentChunk = '';
                }
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
        const loadingNotice = new Notice('Loading audio...', 0);
        
        try {
            for (const chunk of chunks) {
                if (!this.isPlaying) break;
                
                const audioBuffer = await this.openAIService.textToSpeech(chunk);
                const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
                const url = URL.createObjectURL(blob);
                
                await new Promise<void>((resolve, reject) => {
                    this.audioElement = new Audio(url);
                    this.audioElement.onended = () => {
                        URL.revokeObjectURL(url);
                        resolve();
                    };
                    this.audioElement.onerror = reject;
                    
                    if (chunk === chunks[0]) {
                        loadingNotice.hide();
                    }
                    
                    this.audioElement.play().catch(reject);
                });
            }
        } catch (error) {
            loadingNotice.hide();
            throw error;
        }
    }

    public async playText(text: string) {
        if (this.isPlaying) {
            this.stop();
            return;
        }

        this.isPlaying = true;
        this.onStateChange(true);

        try {
            const chunks = this.chunkText(text);
            await this.playChunks(chunks);
            this.stop();
        } catch (error) {
            console.error('Error playing audio:', error);
            new Notice('Error playing audio');
            this.stop();
        }
    }

    public togglePlayPause() {
        if (this.audioElement) {
            if (this.isPlaying) {
                this.audioElement.pause();
                this.onStateChange(false);
            } else {
                this.audioElement.play();
                this.onStateChange(true);
            }
            this.isPlaying = !this.isPlaying;
        }
    }

    public stop() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            this.isPlaying = false;
            this.onStateChange(false);
        }
    }

    public play() {
        if (this.audioElement) {
            this.audioElement.play().catch(error => {
                console.error('Error playing audio:', error);
                this.isPlaying = false;
                this.onStateChange(false);
            });
            this.isPlaying = true;
            this.onStateChange(true);
        }
    }
} 