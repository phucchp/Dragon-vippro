# Script Generator

A Node.js script that generates engaging film narration scripts from SRT subtitle files using Google's Gemini AI. It handles large subtitle files by chunking them into manageable parts, processing each chunk with AI, and then merging the results into a cohesive script.

## Features

- **Chunked Processing**: Splits large SRT files into smaller chunks to fit API limits
- **AI-Powered Generation**: Uses Gemini 2.5 Flash model for high-quality script creation
- **Automatic Merging**: Combines partial scripts into a seamless final narration
- **Configurable**: Adjustable chunk size and model parameters

## Prerequisites

- Node.js (ES modules support)
- Google Gemini API key
- SRT subtitle file in `../../outputs/downloaded-subtitles/{video_id}/{video_id}.txt`
- Prompt template in `../../prompts/film_review_narration_from_subtitles_prompt.txt`

## Installation

Ensure dependencies are installed in the root project:

```bash
npm install @google/generative-ai dotenv
```

## Usage

```bash
node generate-script.js <video_id>
```

### Example

```bash
node generate-script.js mTh61qbwyJ8
```

This will:
1. Read the SRT file from `../../outputs/downloaded-subtitles/mTh61qbwyJ8/mTh61qbwyJ8.txt`
2. Load the prompt from `../../prompts/film_review_narration_from_subtitles_prompt.txt`
3. Process the SRT in chunks using Gemini AI
4. Generate and merge partial scripts
5. Save the final script to `../../outputs/generated-scripts/mTh61qbwyJ8/script.txt`

## Configuration

- **CHUNK_SIZE_CHARS**: Adjust chunk size (default: 12000 characters)
- **MODEL_NAME**: Gemini model to use (default: "gemini-2.5-flash")
- **maxOutputTokens**: Maximum output tokens per API call (default: 5000 for chunks, 10000 for merge)
- **temperature**: Controls randomness in generation - Mức sáng tạo (0 → cứng, 1 → bay) (default: 0.55 for chunks, 0.5 for merge)
- **topP**: Nucleus sampling parameter (default: 0.9)
- **topK**: Top-k sampling parameter (default: 40)
- Generation parameters can be modified in the `callGemini` and `mergeAll` functions

## Environment Variables

Set in `../../.env`:
- `GEMINI_API_KEY`: Your Google Gemini API key

## Output

- Creates directory: `../../outputs/generated-scripts/{video_id}/`
- Saves final script as: `script.txt`

## Notes

- Designed for Vietnamese film review narration scripts
- Handles SRT files up to ~50,000+ characters by chunking
- Final script is approximately 30-40% of original SRT length
- Requires ES module support (add `"type": "module"` to package.json if needed)

## License

MIT License

Author: Phúc Hữu + ChatGPT (Gemini Automation Workflow)
