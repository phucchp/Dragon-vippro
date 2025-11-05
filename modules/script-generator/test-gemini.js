// test-gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

// Lấy key từ env
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ Chưa có GEMINI_API_KEY. export GEMINI_API_KEY=... trước đã.");
    process.exit(1);
}

async function main() {
    try {
        // Khởi tạo client
        const genAI = new GoogleGenerativeAI(apiKey);

        // Chọn model — bạn yêu cầu gemini-2.5-flash
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
        });

        // Prompt test
        const prompt = "Viết 1 đoạn giới thiệu ngắn về video review sách dài 80 từ, tiếng Việt.";

        // Gọi API
        const result = await model.generateContent(prompt);

        // Tuỳ SDK version, kết quả sẽ nằm ở đây
        const text = result.response.text();
        console.log("✅ Kết quả từ Gemini:");
        console.log(text);
    } catch (err) {
        console.error("❌ Lỗi gọi Gemini:", err?.response?.data || err);
    }
}

main();
