# Skribe
Research: Transcribe, Summarize, Chat

# Description
An Obsidian plugin for transcribing, summarizing, and chatting with video content.

## Features
- **YouTube Transcript Fetching**: Automatically fetch transcripts from YouTube videos using URLs
- **Direct Transcript Input**: Paste transcript content directly for analysis
- **AI-Powered Summarization**: Generate summaries using OpenAI's GPT models
- **Interactive Chat**: Chat with your transcripts using AI assistance
- **Multi-Transcript Support**: Work with multiple transcripts simultaneously
- **Playlist Support**: Process entire YouTube playlists
- **Smart Content Detection**: Automatically detects whether input is a YouTube URL or transcript content

## Usage
1. **YouTube Videos**: Paste a YouTube URL to automatically fetch and analyze the transcript
2. **Direct Transcripts**: Paste transcript content directly for immediate analysis
3. **Playlists**: Use YouTube playlist URLs to process multiple videos
4. **Multiple Sources**: Combine multiple YouTube URLs or transcript content for comprehensive analysis

## Input Methods
- **YouTube URLs**: `https://www.youtube.com/watch?v=VIDEO_ID`
- **YouTube Shorts**: `https://youtu.be/VIDEO_ID`
- **Playlists**: `https://www.youtube.com/playlist?list=PLAYLIST_ID`
- **Transcript Content**: Paste any transcript text directly
- **Multiple Sources**: Comma-separated URLs or mixed content

## Requirements
- OpenAI API key for AI features
- Internet connection for YouTube transcript fetching

## Settings
- **Transcript Folder**: Choose where to save transcript files
- **OpenAI Model**: Select your preferred GPT model
- **Max Transcript Length**: Control how much transcript content is sent to OpenAI API (default: 50k characters ≈ 12.5k tokens)
  - Higher values provide more context but may hit API limits
  - Lower values reduce API costs and improve response times
  - Adjust based on your model's context window and needs

## Available Models

| Model | Context Window | Input Cost | Output Cost | Best For |
|-------|---------------|------------|-------------|----------|
| **GPT-4o** | 128k tokens | $2.50/1M | $5.00/1M | Best quality, complex analysis |
| **GPT-4o-mini** | 128k tokens | $0.15/1M | $0.60/1M | Cost-effective, good quality |
| **GPT-4 Turbo** | 128k tokens | $10.00/1M | $30.00/1M | High performance, expensive |
| **GPT-4** | 8k tokens | $30.00/1M | $60.00/1M | Legacy, limited context |
| **GPT-3.5-turbo** | 4k tokens | $0.50/1M | $1.50/1M | Legacy, very limited context |

**Recommendation**: Start with **GPT-4o-mini** for the best balance of cost and quality.
