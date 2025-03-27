export interface SkribeSettings {
    youtubeApiKey: string;
    transcriptFolder: string;
    openaiApiKey: string;
    model: string;
    voice: string;
    includeTimestampInFilename: boolean;
    includeContentTypeInFilename: boolean;
    quips: string[];
}

export const DEFAULT_SETTINGS: SkribeSettings = {
    youtubeApiKey: '',
    transcriptFolder: 'Transcripts',
    openaiApiKey: '',
    model: 'gpt-4o',
    voice: 'alloy',
    includeTimestampInFilename: true,
    includeContentTypeInFilename: false,
    quips: []
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

export interface ToolbarCommand {
    id: string;
    icon: string;
    tooltip: string;
    isEnabled: (context: CommandContext) => boolean;
    execute: (context: CommandContext) => void | Promise<void>;
}

export interface CommandContext {
    plugin: any;
    view: any;
    content?: string;
    videoUrl?: string;
    videoTitle?: string;
    activeTab?: string;
    [key: string]: any; // Allow for additional context properties
}

export interface ToolbarConfig {
    id: string;
    name: string;
    commands: ToolbarCommand[];
}

declare global {
    interface Window {
        ytInitialPlayerResponse: any;
    }
} 