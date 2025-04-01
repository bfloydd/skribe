export interface SkribeSettings {
    youtubeApiKey: string;
    transcriptFolder: string;
    openaiApiKey: string;
    model: string;
    voice: string;
    includeTimestampInFilename: boolean;
    includeContentTypeInFilename: boolean;
    quips: string[];
    savedState?: SkribeState;
    debugMode?: boolean;
}

export interface SkribeState {
    content: string;
    videoUrl: string;
    videoTitle: string;
    revisedContent: string;
    summaryContent: string;
    chatState: ChatState;
    activeTab: 'transcript' | 'revised' | 'summary' | 'chat';
    lastUpdated: number;
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
    videoTitle?: string;
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