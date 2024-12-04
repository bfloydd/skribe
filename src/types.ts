export interface SkribeSettings {
    youtubeApiKey: string;
    transcriptFolder: string;
    openaiApiKey: string;
}

export const DEFAULT_SETTINGS: SkribeSettings = {
    youtubeApiKey: '',
    transcriptFolder: 'Transcripts',
    openaiApiKey: ''
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

declare global {
    interface Window {
        ytInitialPlayerResponse: any;
    }
} 