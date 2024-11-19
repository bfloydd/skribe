import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf, Command } from 'obsidian';
import { YoutubeTranscript } from 'youtube-transcript';

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
						this.handleTranscriptRequest(markdownView);
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
		try {
			console.log('→ Starting API request for video:', videoId);







			
			if (!this.settings.youtubeApiKey) {
				throw new Error('YouTube API key not configured');
			}

			// First, get the caption tracks list
			const captions_url = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${this.settings.youtubeApiKey}`;
			const response = await fetch(captions_url);
			console.log('→ Captions list response status:', response.status);
			
			const data = await response.json();
			console.log('→ Captions list data:', data);

			if (!data.items || data.items.length === 0) {
				throw new Error('No captions found for this video');
			}

			// Find English captions (or the first available)
			const captionTrack = data.items.find((item: any) => 
				item.snippet.language === 'en'
			) || data.items[0];

			console.log('→ Selected caption track:', captionTrack);

			// Get the actual transcript using timedtext API
			const transcriptUrl = `https://www.youtube.com/api/timedtext?lang=${captionTrack.snippet.language}&v=${videoId}&fmt=srv3`;
			const transcriptResponse = await fetch(transcriptUrl);
			const transcriptText = await transcriptResponse.text();
			
			console.log('→ Transcript response:', transcriptText);

			// Parse the XML response
			const parser = new DOMParser();
			const xmlDoc = parser.parseFromString(transcriptText, "text/xml");
			const textElements = xmlDoc.getElementsByTagName('text');
			
			// Combine all text elements
			let fullTranscript = '';
			for (let i = 0; i < textElements.length; i++) {
				fullTranscript += textElements[i].textContent + ' ';
			}

			console.log('→ Processed transcript:', fullTranscript);
			return fullTranscript.trim();

		} catch (error) {
			console.error('Error fetching transcript:', error);
			throw error;
		}
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

	private async handleTranscriptRequest(activeView: MarkdownView) {
		console.log('handleTranscriptRequest called');
		const editor = activeView.editor;
		const selection = editor.getSelection();
		console.log('Selected text:', selection);

		if (!selection) {
			new Notice('Please select a YouTube URL first');
			return;
		}

		if (!this.isYouTubeUrl(selection)) {
			new Notice('Invalid YouTube URL. Please select a valid YouTube URL');
			return;
		}

		const videoId = this.extractVideoId(selection);
		console.log('Extracted video ID:', videoId);

		if (!videoId) {
			new Notice('Could not extract video ID from the URL');
			return;
		}

		new Notice('Fetching transcript...');
		try {
			// const transcript = await this.getYouTubeTranscript(videoId);
			// console.log('Transcript:', transcript);

			var yt = require("youtube-transcript");
			var transcript_obj = await yt.YoutubeTranscript.fetchTranscript('_cY5ZD9yh2I');
			console.log('Transcript1:', transcript_obj);
			const text = transcript_obj.map((t: any) => t.text).join(' ');
			console.log('Transcript2:', text);

			
			const view = await this.activateView();
			// view.setContent(transcript);
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
