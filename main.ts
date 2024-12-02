import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf, Command } from 'obsidian';

// Remember to rename these classes and interfaces!

interface VTSSettings {
	youtubeApiKey: string;
}

const DEFAULT_SETTINGS: VTSSettings = {
	youtubeApiKey: ''
}

export const VIEW_TYPE_TRANSCRIPTION = "transcription-view";

export class TranscriptionView extends ItemView {
	content: string;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.content = '';
	}

	getViewType() {
		return VIEW_TYPE_TRANSCRIPTION;
	}

	getDisplayText() {
		return "Video Transcription";
	}

	setContent(content: string) {
		this.content = content;
		this.refresh();
	}

	async onOpen() {
		this.refresh();
	}

	async refresh() {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl("div", { text: this.content });
	}
}

export class URLInputModal extends Modal {
	result: string;
	onSubmit: (result: string) => void;

	constructor(app: App, onSubmit: (result: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.createEl("h2", { text: "Enter YouTube URL" });

		const inputEl = contentEl.createEl("input", {
			type: "text",
			placeholder: "https://www.youtube.com/watch?v=..."
		});
		inputEl.style.width = "100%";
		inputEl.style.marginBottom = "1em";

		const buttonEl = contentEl.createEl("button", {
			text: "Get Transcript"
		});
		buttonEl.addEventListener("click", () => {
			this.onSubmit(inputEl.value);
			this.close();
		});

		// Allow Enter key to submit
		inputEl.addEventListener("keypress", (e) => {
			if (e.key === "Enter") {
				this.onSubmit(inputEl.value);
				this.close();
			}
		});
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

export default class VTS extends Plugin {
	settings: VTSSettings;
	view: TranscriptionView;

	async onload() {
		console.log('Loading VTS plugin...');
		
		await this.loadSettings();

		// Simplified command registration for testing
		this.addCommand({
			id: 'get-selected-transcript',
			name: 'Get Selected Video Transcript',
				callback: () => {
					console.log('Command executed - simple callback');
					const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (markdownView) {
						const selection = markdownView.editor.getSelection();
						if (selection) {
							this.handleTranscriptRequest(selection);
						} else {
							new Notice('Please select a YouTube URL first');
						}
					} else {
						new Notice('Please open a markdown file first');
					}
				}
		});

		// console.log('Command registered:', this.app.commands.commands); // Debug registered commands

		// Register view
		this.registerView(
			VIEW_TYPE_TRANSCRIPTION,
			(leaf) => new TranscriptionView(leaf)
		);

		this.addSettingTab(new VTSSettingTab(this.app, this));

		// Add this new command after the existing command registration
		this.addCommand({
			id: 'prompt-youtube-url',
			name: 'Skribe: Prompt for URL',
			callback: () => {
				new URLInputModal(this.app, (url) => {
					if (this.isYouTubeUrl(url)) {
						const videoId = this.extractVideoId(url);
						if (videoId) {
							this.handleTranscriptRequest(url);
						} else {
							new Notice('Could not extract video ID from the URL');
						}
					} else {
						new Notice('Invalid YouTube URL');
					}
				}).open();
			}
		});
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;
		
		let leaf = workspace.getRightLeaf(false);
		if (!leaf) {
			leaf = workspace.getLeaf('split', 'vertical');
		}
		
		await leaf.setViewState({
			type: VIEW_TYPE_TRANSCRIPTION,
			active: true,
		});

		this.view = leaf.view as TranscriptionView;
		return this.view;
	}

	async getYouTubeTranscript(videoId: string): Promise<string> {
		// Stub implementation
		console.log('Stub getYouTubeTranscript called with videoId:', videoId);
		
		// Return some mock transcript data
// 		return `This is a stubbed transcript for video ${videoId}.
		
// Line 1 of the mock transcript.
// Line 2 of the mock transcript.
// Line 3 includes some technical terms.
// Line 4 has more sample content.
// Line 5 concludes this stub transcript.`;



			// const videoId = new URLSearchParams(window.location.search).get('v');
			const YT_INITIAL_PLAYER_RESPONSE_RE =
				/ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*(?:var\s+(?:meta|head)|<\/script|\n)/;
			let player = window.ytInitialPlayerResponse;
			if (!player || videoId !== player.videoDetails.videoId) {
				fetch('https://www.youtube.com/watch?v=' + videoId)
					.then(function (response) {
						return response.text();
					})
					.then(function (body) {
						const playerResponse = body.match(YT_INITIAL_PLAYER_RESPONSE_RE);
						if (!playerResponse) {
							console.warn('Unable to parse playerResponse');
							return;
						}
						player = JSON.parse(playerResponse[1]);
						const metadata = {
							title: player.videoDetails.title,
							duration: player.videoDetails.lengthSeconds,
							author: player.videoDetails.author,
							views: player.videoDetails.viewCount,
						};
						// Get the tracks and sort them by priority
						const tracks = player.captions.playerCaptionsTracklistRenderer.captionTracks;
						tracks.sort(compareTracks);

						// Get the transcript
						fetch(tracks[0].baseUrl + '&fmt=json3')
							.then(function (response) {
								return response.json();
							})
							.then(function (transcript) {
								const result = { transcript: transcript, metadata: metadata };

								const parsedTranscript = transcript.events
									// Remove invalid segments
									.filter(function (x: TranscriptEvent) {
										return x.segs;
									})

									// Concatenate into single long string
									.map(function (x: TranscriptEvent) {
										return x.segs
											.map(function (y: TranscriptSegment) {
												return y.utf8;
											})
											.join(' ');
									})
									.join(' ')

									// Remove invalid characters
									.replace(/[\u200B-\u200D\uFEFF]/g, '')

									// Replace any whitespace with a single space
									.replace(/\s+/g, ' ');

								// Use 'result' here as needed
								console.log('EXTRACTED_TRANSCRIPT', parsedTranscript);
							});
					});

		}

		function compareTracks(track1: CaptionTrack, track2: CaptionTrack) {
			const langCode1 = track1.languageCode;
			const langCode2 = track2.languageCode;

			if (langCode1 === 'en' && langCode2 !== 'en') {
				return -1; // English comes first
			} else if (langCode1 !== 'en' && langCode2 === 'en') {
				return 1; // English comes first
			} else if (track1.kind !== 'asr' && track2.kind === 'asr') {
				return -1; // Non-ASR comes first
			} else if (track1.kind === 'asr' && track2.kind !== 'asr') {
				return 1; // Non-ASR comes first
			}

			return 0; // Preserve order if both have same priority
		}


		return "";

	}

	isYouTubeUrl(url: string): boolean {
		const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
		return pattern.test(url);
	}

	extractVideoId(url: string): string | null {
		const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
		const match = url.match(regExp);
		return (match && match[2].length === 11) ? match[2] : null;
	}

	private async handleTranscriptRequest(url: string) {
		console.log('handleTranscriptRequest called');
		console.log('URL:', url);

		if (!this.isYouTubeUrl(url)) {
			new Notice('Invalid YouTube URL');
			return;
		}

		const videoId = this.extractVideoId(url);
		console.log('Extracted video ID:', videoId);

		if (!videoId) {
			new Notice('Could not extract video ID from the URL');
			return;
		}

		new Notice('Fetching transcript...');
		try {
			const transcript = await this.getYouTubeTranscript(videoId);
			console.log('Transcript:', transcript);
			
			const view = await this.activateView();
			view.setContent(transcript);
			new Notice('Transcript loaded successfully');
		} catch (error) {
			new Notice('Failed to fetch transcript. Check console for details');
			console.error('VTS Transcript Error:', error);
		}
	}
}

class VTSModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class VTSSettingTab extends PluginSettingTab {
	plugin: VTS;

	constructor(app: App, plugin: VTS) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('YouTube API Key')
			.setDesc('Enter your YouTube Data API key')
			.addText(text => text
				.setPlaceholder('Enter API key')
				.setValue(this.plugin.settings.youtubeApiKey)
				.onChange(async (value) => {
					this.plugin.settings.youtubeApiKey = value;
					await this.plugin.saveSettings();
				}));
	}
}

// Add this near the top of the file, after the imports
declare global {
    interface Window {
        ytInitialPlayerResponse: any;  // You can replace 'any' with a more specific type if needed
    }
}

// Add these interfaces near the top of the file
interface TranscriptSegment {
    utf8: string;
}

interface TranscriptEvent {
    segs: TranscriptSegment[];
}

interface CaptionTrack {
    languageCode: string;
    kind: string;
}
