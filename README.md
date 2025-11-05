# Video Script Generator

Dự án xử lý video với 2 module chính sử dụng JavaScript/Node.js:

## 🎯 Tổng quan

### Module 1: Upload Video to YouTube
- **Upload video lên YouTube**: Tự động upload video và nhận video ID

### Module 2: Download Subtitle from YouTube
- **Download subtitle**: Tải file SRT từ link video YouTube đã có subtitle

### Module 3: Script Generator
- **Tạo kịch bản tóm tắt**: Từ video gốc hoặc file SRT, tạo bản tóm tắt hấp dẫn
- **Tạo kịch bản review**: Viết review chuyên nghiệp theo phong cách reviewer

## 🚀 Cài đặt

```bash
# Clone repository (nếu có)
# cd video-script-generator

# Install dependencies
npm install
```

## ⚙️ Cấu hình

### 1. File .env
Tạo file `.env` trong thư mục gốc và điền thông tin:

```env
# YouTube API Configuration
YOUTUBE_API_KEY=your_youtube_api_key_here
YOUTUBE_CLIENT_ID=your_youtube_client_id_here
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret_here
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth2callback

# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Server Configuration
PORT=3000
```

### 2. YouTube API Setup
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project hiện có
3. Kích hoạt YouTube Data API v3
4. Tạo OAuth 2.0 credentials
5. Thêm `http://localhost:3000/oauth2callback` vào Authorized redirect URIs

### 3. Gemini API Setup
1. Truy cập [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Tạo API key mới
3. Copy API key vào file `.env`

### 4. FFmpeg (cho xử lý video)
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows - Download từ https://ffmpeg.org/download.html
```

## 🏃‍♂️ Chạy ứng dụng

```bash
# Development mode
npm run dev

# Production mode
npm start

# Test APIs
npm test
```

Server sẽ chạy tại `http://localhost:3000`

## 📡 API Endpoints

### Module 1: Upload Video to YouTube

#### Upload Video lên YouTube
```http
POST /upload-video
Content-Type: multipart/form-data

Form data:
- video: File (video file)
- title: String (video title)
- description: String (video description - optional)
```

**Response:**
```json
{
  "success": true,
  "videoId": "VIDEO_ID",
  "title": "Video Title",
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

### Module 2: Download Subtitle from YouTube

#### Download SRT từ Video ID
```http
GET /download-srt/:videoId
```

#### Download SRT từ URL đầy đủ
```http
POST /download-srt-url
Content-Type: application/json

{
  "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:** File SRT được tải về

### Module 3: Script Generator

#### Tạo kịch bản tóm tắt
```http
POST /generate-summary
Content-Type: multipart/form-data

Form data:
- file: File (video hoặc SRT file) - optional
- text: String (nội dung text) - optional
```

**Response:**
```json
{
  "summary": "Nội dung kịch bản tóm tắt..."
}
```

#### Tạo kịch bản review
```http
POST /generate-review
Content-Type: multipart/form-data

Form data:
- file: File (video hoặc SRT file) - optional
- text: String (nội dung text) - optional
```

**Response:**
```json
{
  "review": "Nội dung kịch bản review..."
}
```

### Health Check
```http
GET /health
```

## 🧪 Test

Chạy file test để kiểm tra các API:

```bash
node test.js
```

## 📁 Cấu trúc thư mục

```
video-script-generator/
├── modules/
│   ├── upload-video/
│   │   └── index.js          # Module upload video lên YouTube
│   ├── download-subtitle/
│   │   └── index.js          # Module download SRT từ YouTube URL
│   └── script-generator/
│       └── index.js          # Module tạo kịch bản với Gemini AI
├── uploads/                  # Thư mục lưu video upload tạm thời
├── outputs/                  # Thư mục lưu kịch bản output của các modules
│   ├── downloaded-subtitles/ # Output module download/subtitle
│   ├── generated-scripts/    # module script-generator (Gemini) xuất kịch bản JSON/markdown
│   ├── uploaded-videos/      # module upload lên YT/TikTok lưu log
├── index.js                  # Server chính
├── test.js                   # File test API
├── package.json
├── .env                      # Cấu hình API keys
├── .gitignore
└── README.md
```

## 🛠️ Công nghệ sử dụng

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **YouTube Data API** - Upload video và download subtitle
- **Google Gemini AI** - Tạo kịch bản thông minh
- **FFmpeg** - Xử lý video/audio
- **Multer** - File upload handling

## 🔒 Bảo mật

- Không commit file `.env` vào Git
- Sử dụng HTTPS trong production
- Validate file upload (size, type)
- Rate limiting cho API calls

## 📝 Lưu ý

- Video upload có giới hạn 100MB
- Cần cấu hình YouTube OAuth2 để upload video
- Gemini API cần API key hợp lệ
- SRT download chỉ hoạt động với video có subtitle

## 🤝 Đóng góp

1. Fork project
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request