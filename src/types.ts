export interface SkribeSettings {
    youtubeApiKey: string;
    transcriptFolder: string;
    openaiApiKey: string;
    model: string;
    voice: string;
}

export const DEFAULT_SETTINGS: SkribeSettings = {
    youtubeApiKey: '',
    transcriptFolder: 'Transcripts',
    openaiApiKey: '',
    model: 'gpt-4o',
    voice: 'alloy'
}

export interface TranscriptSegment {
    utf8: string;
}

export interface TranscriptEvent {
    segs: TranscriptSegment[];
}

export interface CaptionTrack {
    languageCode: string;
    kind: string;
    baseUrl: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatState {
    messages: ChatMessage[];
    videoUrl?: string;
}

declare global {
    interface Window {
        ytInitialPlayerResponse: any;
    }
} 