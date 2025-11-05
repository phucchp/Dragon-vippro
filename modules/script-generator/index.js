const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

class ScriptGenerator {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        if(!this.genAI) {
            throw new Error('❌Failed to initialize Google Generative AI client. Please check your API key.');
        }
    }

    /**
     * Extract text from SRT file
     * @param {string} srtPath - Path to SRT file
     * @returns {Promise<string>} Extracted text content
     */
    async extractTextFromSRT(srtPath) {
        try {
            const srtContent = fs.readFileSync(srtPath, 'utf8');

            // Simple SRT parser - remove timestamps and numbers
            const lines = srtContent.split('\n');
            const textLines = lines.filter(line => {
                // Remove empty lines, numbers, and timestamp lines
                return line.trim() &&
                    !/^\d+$/.test(line.trim()) &&
                    !/\d{2}:\d{2}:\d{2},\d{3}/.test(line.trim()) &&
                    !line.includes('-->');
            });

            return textLines.join(' ').trim();
        } catch (error) {
            throw new Error(`Failed to extract text from SRT: ${error.message}`);
        }
    }

    /**
     * Extract text from video (placeholder - would need speech-to-text)
     * @param {string} videoPath - Path to video file
     * @returns {Promise<string>} Extracted text content
     */
    async extractTextFromVideo(videoPath) {
        // This is a placeholder. In a real implementation, you would:
        // 1. Extract audio from video using FFmpeg
        // 2. Use speech-to-text API (Google Speech-to-Text, AWS Transcribe, etc.)
        // 3. Return transcribed text

        return new Promise((resolve, reject) => {
            const audioPath = videoPath.replace(path.extname(videoPath), '.wav');

            ffmpeg(videoPath)
                .toFormat('wav')
                .audioChannels(1)
                .audioFrequency(16000)
                .on('end', () => {
                    // Here you would call a speech-to-text service
                    // For now, return a placeholder
                    fs.unlinkSync(audioPath); // Clean up
                    resolve('Video transcription would be implemented here using speech-to-text API');
                })
                .on('error', (err) => {
                    reject(new Error(`Failed to extract audio: ${err.message}`));
                })
                .save(audioPath);
        });
    }

    /**
     * Generate summary script from content
     * @param {string} content - Text content to summarize
     * @returns {Promise<string>} Generated summary
     */
    async generateSummary(content) {
        try {
            const prompt = `
Bạn là một chuyên gia tạo kịch bản tóm tắt video. Nhiệm vụ của bạn là tạo một kịch bản tóm tắt hấp dẫn và cô đọng từ nội dung được cung cấp.

Yêu cầu:
- Tóm tắt các điểm chính của nội dung
- Sử dụng ngôn ngữ tự nhiên, hấp dẫn
- Độ dài: 200-400 từ
- Cấu trúc: Giới thiệu -> Nội dung chính -> Kết luận
- Không cần timeline, chỉ cần văn bản thuần túy

Nội dung cần tóm tắt:
${content}

Hãy tạo kịch bản tóm tắt:
`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();
        } catch (error) {
            throw new Error(`Failed to generate summary: ${error.message}`);
        }
    }

    /**
     * Generate review script from content
     * @param {string} content - Text content to create review from
     * @returns {Promise<string>} Generated review script
     */
    async generateReview(content) {
        try {
            const prompt = `
Bạn là một nhà phê bình chuyên nghiệp, chuyên viết kịch bản review video chất lượng cao. Nhiệm vụ của bạn là tạo một kịch bản review theo phong cách chuyên nghiệp từ nội dung được cung cấp.

Yêu cầu:
- Phong cách: Chuyên nghiệp, khách quan, mang tính xây dựng
- Cấu trúc: Giới thiệu -> Phân tích chi tiết -> Đánh giá -> Kết luận
- Độ dài: 400-600 từ
- Bao gồm: Điểm mạnh, điểm yếu, đề xuất cải thiện
- Ngôn ngữ: Trang trọng nhưng gần gũi

Nội dung cần review:
${content}

Hãy tạo kịch bản review:
`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();
        } catch (error) {
            throw new Error(`Failed to generate review: ${error.message}`);
        }
    }

    /**
     * Save generated script to file
     * @param {string} content - Script content
     * @param {string} filename - Output filename
     * @param {string} type - Script type (summary/review)
     */
    saveScriptToFile(content, filename, type = 'script') {
        const outputDir = path.join(__dirname, '../../outputs');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const filePath = path.join(outputDir, `${filename}_${type}.txt`);
        fs.writeFileSync(filePath, content, 'utf8');

        return filePath;
    }
}

module.exports = new ScriptGenerator();