require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed!'), false);
        }
    }
});

// Import modules
const uploadVideo = require('./modules/upload-video');
const downloadSubtitle = require('./modules/download-subtitle');
const scriptGenerator = require('./modules/script-generator');

// Routes for Module 1: Upload Video
app.post('/upload-video', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        const result = await uploadVideo.uploadToYouTube(req.file.path, req.body.title, req.body.description);
        res.json(result);
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Routes for Module 2: Download Subtitle
app.get('/download-srt/:videoId', async (req, res) => {
    try {
        const srtContent = await downloadSubtitle.downloadSRT(`https://www.youtube.com/watch?v=${req.params.videoId}`);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', 'attachment; filename="subtitle.srt"');
        res.send(srtContent);
    } catch (error) {
        console.error('Download SRT error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/download-srt-url', async (req, res) => {
    try {
        const { videoUrl } = req.body;
        if (!videoUrl) {
            return res.status(400).json({ error: 'Video URL is required' });
        }

        const srtContent = await downloadSubtitle.downloadSRT(videoUrl);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', 'attachment; filename="subtitle.srt"');
        res.send(srtContent);
    } catch (error) {
        console.error('Download SRT error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Routes for Module 2: Script Generator
app.post('/generate-summary', upload.single('file'), async (req, res) => {
    try {
        let content = '';

        if (req.file) {
            // File upload (video or SRT)
            if (req.file.mimetype === 'text/plain' || path.extname(req.file.originalname) === '.srt') {
                content = await scriptGenerator.extractTextFromSRT(req.file.path);
            } else if (req.file.mimetype.startsWith('video/')) {
                // Extract audio and transcribe (placeholder)
                content = await scriptGenerator.extractTextFromVideo(req.file.path);
            }
        } else if (req.body.text) {
            content = req.body.text;
        } else {
            return res.status(400).json({ error: 'No content provided' });
        }

        const summary = await scriptGenerator.generateSummary(content);
        res.json({ summary });
    } catch (error) {
        console.error('Summary generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/generate-review', upload.single('file'), async (req, res) => {
    try {
        let content = '';

        if (req.file) {
            if (req.file.mimetype === 'text/plain' || path.extname(req.file.originalname) === '.srt') {
                content = await scriptGenerator.extractTextFromSRT(req.file.path);
            } else if (req.file.mimetype.startsWith('video/')) {
                content = await scriptGenerator.extractTextFromVideo(req.file.path);
            }
        } else if (req.body.text) {
            content = req.body.text;
        } else {
            return res.status(400).json({ error: 'No content provided' });
        }

        const review = await scriptGenerator.generateReview(content);
        res.json({ review });
    } catch (error) {
        console.error('Review generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Video Script Generator is running' });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ error: error.message });
});

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;