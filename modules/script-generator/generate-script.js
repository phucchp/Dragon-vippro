// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

// ====== CONFIG ======
const CHUNK_SIZE_CHARS = 12000; // tăng/giảm tùy file srt
const MODEL_NAME = "gemini-2.5-flash";

// ====== CLI ======
const videoId = process.argv[2];
if (!videoId) {
    console.error("❌ Thiếu video_id. Sử dụng: node generate-script-chunked.js <video_id>");
    process.exit(1);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ Chưa có GEMINI_API_KEY.");
    process.exit(1);
}

// ====== HELPER: chia chuỗi dài thành nhiều đoạn ======
function chunkString(str, chunkSize) {
    const chunks = [];
    for (let i = 0; i < str.length; i += chunkSize) {
        chunks.push(str.slice(i, i + chunkSize));
    }
    return chunks;
}

async function callGemini(genAI, instructionPrompt, srtPart, index, total) {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const generationConfig = {
        temperature: 0.55,
        topP: 0.9,
        topK: 40,
        // tăng cho an tâm, mỗi chunk chỉ cần < 3000 token
        maxOutputTokens: 5000,
    };

    const res = await model.generateContent({
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text:
                            instructionPrompt +
                            `\n\nBạn đang xử lý PHẦN ${index + 1}/${total} của phụ đề. ` +
                            `Hãy viết kịch bản cho phần này sao cho mạch truyện rõ ràng. ` +
                            `Đừng nói kiểu “phần này kết thúc ở đây”, chỉ kể tiếp câu chuyện.`,
                    },
                ],
            },
            {
                role: "user",
                parts: [
                    {
                        text: "Dưới đây là phụ đề của phần này:\n\n" + srtPart,
                    },
                ],
            },
        ],
        generationConfig,
    });

    return res.response.text();
}

async function mergeAll(genAI, instructionPrompt, partialScripts) {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const mergedInput = partialScripts
        .map((txt, i) => `---PHẦN ${i + 1}---\n${txt}`)
        .join("\n\n");

    const generationConfig = {
        temperature: 0.5,
        topP: 0.9,
        topK: 40,
        // cho phép output dài hơn
        maxOutputTokens: 20000,
    };

    // prompt merge: đây là pass 2
    const mergePrompt =
        instructionPrompt +
        `
Bây giờ tôi gửi cho bạn nhiều đoạn kịch bản (đã được model viết lại từ từng phần phụ đề).
Nhiệm vụ của bạn:
- Ghép chúng lại thành MỘT kịch bản kể phim liền mạch.
- Không lặp lại câu mở đầu ở mỗi phần.
- Nếu thấy trùng lặp cảnh thì gộp lại mượt mà.
- Giữ phong cách kể chuyện như hướng dẫn ban đầu.
- Và QUAN TRỌNG: cố gắng giữ độ dài khoảng 30-40% so với toàn bộ nội dung gốc (nếu các phần quá dài, bạn ưu tiên giữ các cảnh/nút truyện quan trọng, nhưng không được làm đứt mạch).
- Kết quả cuối: 1 đoạn văn duy nhất, sẵn sàng để lồng tiếng. Không tiêu đề, không đánh số.
`;

    const res = await model.generateContent({
        contents: [
            {
                role: "user",
                parts: [{ text: mergePrompt }],
            },
            {
                role: "user",
                parts: [{ text: mergedInput }],
            },
        ],
        generationConfig,
    });

    return res.response.text();
}

async function main() {
    // ====== 1. Đọc file ======
    const srtPath = path.join(
        process.cwd(),
        "../../outputs/downloaded-subtitles",
        videoId,
        `${videoId}.txt`
    );
    const promptPath = path.join(
        process.cwd(),
        "../../prompts/film_review_narration_from_subtitles_prompt.txt"
    );

    if (!fs.existsSync(srtPath)) {
        console.error("❌ Không tìm thấy SRT:", srtPath);
        process.exit(1);
    }
    if (!fs.existsSync(promptPath)) {
        console.error("❌ Không tìm thấy prompt:", promptPath);
        process.exit(1);
    }

    const srtContent = fs.readFileSync(srtPath, "utf8");
    const instructionPrompt = fs.readFileSync(promptPath, "utf8");

    // ====== 2. Chia nhỏ ======
    const chunks = chunkString(srtContent, CHUNK_SIZE_CHARS);
    console.log(`📦 SRT lớn, đã chia thành ${chunks.length} phần`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const partialScripts = [];

    // ====== 3. Gọi Gemini cho từng phần ======
    for (let i = 0; i < chunks.length; i++) {
        console.log(`🔄 Đang xử lý phần ${i + 1}/${chunks.length}...`);
        const partScript = await callGemini(
            genAI,
            instructionPrompt,
            chunks[i],
            i,
            chunks.length
        );
        partialScripts.push(partScript);
    }

    // ====== 4. Ghép lại ======
    console.log("🧩 Đang merge các phần...");
    const finalScript = await mergeAll(genAI, instructionPrompt, partialScripts);

    // ====== 5. Lưu ======
    const outputDir = path.join(
        process.cwd(),
        "../../outputs/generated-scripts",
        videoId
    );
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, "script.txt");
    fs.writeFileSync(outputPath, finalScript, "utf8");

    console.log("✅ Xong! Đã lưu:", outputPath);
}

main().catch((err) => {
    console.error("❌ Lỗi:", err?.response?.data || err);
});
