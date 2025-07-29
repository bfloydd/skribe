export interface SkribeSettings {
    youtubeApiKey: string;
    transcriptFolder: string;
    openaiApiKey: string;
    model: string;
    voice: string;
    includeTimestampInFilename: boolean;
    includeContentTypeInFilename: boolean;
    maxTranscriptLength: number; // New setting for controlling transcript length
    quips: string[];
    savedState?: SkribeState;
    debugMode?: boolean;
}

export interface SkribeState {
    content: string;
    videoUrl: string;
    videoTitle: string;
    revisedContents: { [index: number]: string }; // Map of transcript index to revised content
    summaryContents: { [index: number]: string }; // Map of transcript index to summary content
    chatStates: { [index: number]: ChatState }; // Map of transcript index to chat state
    summaryContent?: string; // Legacy field for backward compatibility
    chatState?: ChatState; // Legacy field for backward compatibility
    globalChatState?: ChatState; // New field for chat across all transcripts
    activeTab: 'transcript' | 'revised' | 'summary' | 'chat' | 'chat-all';
    lastUpdated: number;
    transcripts?: { content: string, title: string, url: string }[];
    activeTranscriptIndex?: number;
}

export const DEFAULT_SETTINGS: SkribeSettings = {
    youtubeApiKey: '',
    transcriptFolder: 'Transcripts',
    openaiApiKey: '',
    model: 'o4-mini', // Default to the fastest advanced reasoning model
    voice: 'alloy',
    includeTimestampInFilename: true,
    includeContentTypeInFilename: false,
    maxTranscriptLength: 50000, // Default to 50k characters (~12.5k tokens)
    quips: []
}



export interface CaptionTrack {
    languageCode: string;
    kind: string;
    baseUrl: string;
}

// Types for the YouTube transcript API
export interface TranscriptConfig {
    lang?: string;
    country?: string;
}

export interface TranscriptLine {
    text: string;
    offset: number;
    duration: number;
}

export interface VideoData {
    title: string;
    transcriptRequests: Array<{
        url: string;
        headers: Record<string, string>;
        body: string;
    }>;
}

export class YoutubeTranscriptError extends Error {
    constructor(message: string | Error) {
        super(typeof message === 'string' ? message : message.message);
        this.name = 'YoutubeTranscriptError';
    }
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
    chatMessages?: ChatMessage[];
    chatState?: ChatState;
    chatStates?: { [index: number]: ChatState };
    summaryContent?: string;
    summaryContents?: { [index: number]: string };
    revisedContent?: string;
    revisedContents?: { [index: number]: string };
    activeTranscriptIndex?: number;
    transcripts?: { content: string, title: string, url: string }[];
    showQuips?: boolean;
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