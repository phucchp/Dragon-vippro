const { google } = require('googleapis');
const fs = require('fs');

// YouTube API setup
const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
);

// Set credentials if you have a refresh token
if (process.env.YOUTUBE_REFRESH_TOKEN) {
    oauth2Client.setCredentials({
        refresh_token: process.env.YOUTUBE_REFRESH_TOKEN
    });
}

const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client
});

class UploadVideo {
    /**
     * Upload video to YouTube
     * @param {string} filePath - Path to the video file
     * @param {string} title - Video title
     * @param {string} description - Video description
     * @returns {Promise<Object>} Upload result with video ID
     */
    async uploadToYouTube(filePath, title, description = '') {
        try {
            const fileSize = fs.statSync(filePath).size;

            const response = await youtube.videos.insert({
                part: 'id,snippet,status',
                notifySubscribers: false,
                requestBody: {
                    snippet: {
                        title: title,
                        description: description,
                        tags: ['video', 'processing', 'automation']
                    },
                    status: {
                        privacyStatus: 'unlisted' // Change to 'public' if needed
                    }
                },
                media: {
                    body: fs.createReadStream(filePath)
                }
            });

            // Clean up uploaded file
            fs.unlinkSync(filePath);

            return {
                success: true,
                videoId: response.data.id,
                title: title,
                url: `https://www.youtube.com/watch?v=${response.data.id}`
            };
        } catch (error) {
            console.error('YouTube upload error:', error);
            throw new Error(`Failed to upload video to YouTube: ${error.message}`);
        }
    }

    /**
     * Get OAuth2 authorization URL
     * @returns {string} Authorization URL
     */
    getAuthUrl() {
        const scopes = [
            'https://www.googleapis.com/auth/youtube.upload'
        ];

        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes
        });
    }

    /**
     * Set OAuth2 credentials from authorization code
     * @param {string} code - Authorization code
     * @returns {Promise<Object>} Tokens
     */
    async setCredentials(code) {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        return tokens;
    }
}

module.exports = new UploadVideo();