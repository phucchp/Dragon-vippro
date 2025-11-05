# YouTube Subtitle Downloader

This script downloads subtitles from YouTube videos and saves them in TXT, JSON, and SRT formats.

## Prerequisites

- Python 3.6 or higher
- pip (Python package installer)

## Installation

1. **Create a virtual environment** (optional but recommended):
   ```
   python -m venv venv
   ```

2. **Activate the virtual environment**:
   - On macOS/Linux:
     ```
     source venv/bin/activate
     ```
   - On Windows:
     ```
     venv\Scripts\activate
     ```

3. **To deactivate the virtual environment**:
   ```
   deactivate
   ```

4. **Install dependencies**:
   ```
   pip install youtube-transcript-api
   ```

## Usage

Run the script with a YouTube URL or video ID:

```
python downsub.py <YOUTUBE_URL_OR_VIDEO_ID> [--lang <LANGUAGE_CODES>]
```

### Examples

- Download subtitles for a video (auto-detect language):
  ```
  python downsub.py https://www.youtube.com/watch?v=VIDEO_ID
  ```

- Specify preferred languages (comma-separated):
  ```
  python downsub.py VIDEO_ID --lang vi,en
  ```

The output files will be saved in `./outputs/<VIDEO_ID>/` directory.

## Output Formats

- `.txt`: Plain text transcript
- `.json`: Raw transcript data
- `.srt`: SubRip subtitle format

### Docs
- https://pypi.org/project/youtube-transcript-api/