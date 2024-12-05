import { Notice, requestUrl } from 'obsidian';

export class AudioPlayer {
    private audioElement: HTMLAudioElement | null = null;
    private audioQueue: HTMLAudioElement[] = [];
    private pendingChunks: string[] = [];
    private currentChunkIndex: number = 0;
    private isGenerating: boolean = false;
    private openAIKey: string;
    private onStateChange: (isPlaying: boolean) => void;
    private abortController: AbortController | null = null;
    private speechSynth: SpeechSynthesis;
    private utterance: SpeechSynthesisUtterance | null = null;

    constructor(openAIKey: string, onStateChange: (isPlaying: boolean) => void) {
        this.openAIKey = openAIKey;
        this.onStateChange = onStateChange;
        this.speechSynth = window.speechSynthesis;
    }

    private playWithBrowserTTS(text: string) {
        if (this.utterance) {
            this.speechSynth.cancel();
        }

        this.utterance = new SpeechSynthesisUtterance(text);
        this.utterance.rate = 1.2;
        this.utterance.pitch = 1;
        
        // Use a voice similar to OpenAI's alloy if available
        const voices = this.speechSynth.getVoices();
        const preferredVoice = voices.find(voice => 
            voice.name.toLowerCase().includes('microsoft') || 
            voice.name.toLowerCase().includes('google')
        );
        if (preferredVoice) {
            this.utterance.voice = preferredVoice;
        }

        this.onStateChange(true);

        this.utterance.onend = () => {
            this.utterance = null;
            if (this.audioQueue.length > 0) {
                this.startPlayback();
            }
        };

        this.speechSynth.speak(this.utterance);
    }

    private getApproximateTextFor30Seconds(text: string): { firstPart: string, rest: string } {
        // Average reading speed is about 150 words per minute
        // So 30 seconds would be about 75 words
        // Assuming average word length of 5 characters + 1 space = 6 characters
        // 75 words * 6 chars = ~450 characters for 30 seconds
        const estimatedChars = 450;
        
        // Find the end of the sentence closest to our target length
        const textUpToEstimate = text.slice(0, estimatedChars + 100); // Add buffer for finding sentence end
        const sentences = textUpToEstimate.match(/[^.!?]+[.!?]+/g) || [];
        
        let firstPart = '';
        let currentLength = 0;
        
        for (const sentence of sentences) {
            if (currentLength + sentence.length > estimatedChars) {
                break;
            }
            firstPart += sentence;
            currentLength += sentence.length;
        }

        // If no sentence breaks found or text is shorter than estimate
        if (!firstPart) {
            firstPart = text.slice(0, estimatedChars);
        }

        return {
            firstPart: firstPart,
            rest: text.slice(firstPart.length)
        };
    }

    public async playText(text: string) {
        if (this.isGenerating) {
            new Notice('Already generating audio, please wait...');
            return;
        }

        try {
            this.isGenerating = true;
            
            // Get approximately 30 seconds worth of text
            const { firstPart, rest } = this.getApproximateTextFor30Seconds(text);
            
            // Start browser TTS immediately with the first 30 seconds
            this.playWithBrowserTTS(firstPart);
            new Notice('Starting playback...');
            
            // Generate OpenAI audio in background
            this.pendingChunks = this.splitIntoChunks(rest, 500);
            this.generateNextChunks(3);
        } catch (error) {
            console.error('Error:', error);
            new Notice('Failed to generate audio');
            this.reset();
        }
    }

    public togglePlayPause() {
        if (this.utterance) {
            if (this.speechSynth.paused) {
                this.speechSynth.resume();
                this.onStateChange(true);
            } else {
                this.speechSynth.pause();
                this.onStateChange(false);
            }
        } else if (this.audioElement) {
            if (this.audioElement.paused) {
                this.audioElement.play();
                this.onStateChange(true);
            } else {
                this.audioElement.pause();
                this.onStateChange(false);
            }
        }
    }

    public stop() {
        if (this.utterance) {
            this.speechSynth.cancel();
            this.utterance = null;
        }
        if (this.abortController) {
            this.abortController.abort();
        }
        this.reset();
    }

    private reset() {
        if (this.utterance) {
            this.speechSynth.cancel();
            this.utterance = null;
        }
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.audioElement?.pause();
        this.audioElement = null;
        this.audioQueue.forEach(audio => {
            audio.pause();
            const src = audio.src;
            if (src) {
                URL.revokeObjectURL(src);
            }
        });
        this.audioQueue = [];
        this.pendingChunks = [];
        this.currentChunkIndex = 0;
        this.isGenerating = false;
        this.onStateChange(false);
    }

    private async generateNextChunks(count: number = 3) {
        if (this.pendingChunks.length === 0) {
            this.isGenerating = false;
            return;
        }

        const chunksToGenerate = this.pendingChunks.slice(0, count);
        this.pendingChunks = this.pendingChunks.slice(count);

        try {
            // Generate multiple chunks in parallel
            const newAudios = await Promise.all(
                chunksToGenerate.map(chunk => this.generateAudioForChunk(chunk))
            );
            this.audioQueue.push(...newAudios);

            // Continue generating next chunks if needed
            if (this.pendingChunks.length > 0) {
                setTimeout(() => this.generateNextChunks(3), 100); // Add small delay between batches
            } else {
                this.isGenerating = false;
            }
        } catch (error) {
            console.error('Error generating chunks:', error);
            this.isGenerating = false;
        }
    }

    private splitIntoChunks(text: string, chunkSize: number = 400): string[] {
        // First, split by periods to maintain sentence integrity
        const sentences = text.split(/(?<=[.!?])\s+/);
        const chunks: string[] = [];
        let currentChunk = '';

        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
        }
        if (currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
        }
        return chunks;
    }

    private async generateAudioForChunk(text: string): Promise<HTMLAudioElement> {
        this.abortController = new AbortController();

        const response = await requestUrl({
            url: 'https://api.openai.com/v1/audio/speech',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openAIKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'tts-1-hd', // Try HD model for better quality
                input: text,
                voice: 'alloy',
                speed: 1.4 // Even faster playback
            }),
            throw: false
        });

        if (response.status !== 200) {
            throw new Error(`API Error: ${response.text}`);
        }

        const audioBlob = new Blob([response.arrayBuffer], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Preload the audio
        audio.preload = 'auto';
        await new Promise((resolve) => {
            audio.addEventListener('canplaythrough', resolve, { once: true });
            audio.load();
        });

        audio.addEventListener('ended', () => {
            URL.revokeObjectURL(audioUrl);
        });

        return audio;
    }

    private async startPlayback() {
        if (this.audioQueue.length === 0) return;
        
        this.audioElement = this.audioQueue[this.currentChunkIndex];
        await this.audioElement.play();
        this.onStateChange(true);

        this.audioElement.addEventListener('ended', async () => {
            this.currentChunkIndex++;
            if (this.currentChunkIndex < this.audioQueue.length) {
                await this.startPlayback();
            } else if (this.pendingChunks.length === 0 && !this.isGenerating) {
                this.reset();
            }
        });
    }
} 