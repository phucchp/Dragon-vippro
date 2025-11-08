const dotenv = require("dotenv");
dotenv.config();
const path = require("path");
const fs = require("fs");

const { txtToJson } = require("./helper");
const { searchSceneMatchScriptPrompt } = require("./search-scene");

const GEMINI_MODEL = "gemini-embedding-001";
const OUTPUT_DIMS = 768; // tiết kiệm lưu trữ & tăng tốc (có thể 1536/3072)

// ====== CLI ======
const videoId = process.argv[2];
if (!videoId) {
  console.error("❌ Thiếu video_id. Sử dụng: node index.js <video_id>");
  process.exit(1);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ Chưa có GEMINI_API_KEY.");
  process.exit(1);
}

async function main() {
  // ====== 1. Đọc file ======
  const srtPath = path.join(
    __dirname,
    "../../outputs/downloaded-subtitles",
    videoId,
    `${videoId}.txt`
  );
  const promptPath = path.join(
    __dirname,
    "../../prompts/search_scene_prompt.txt"
  );

  const scriptPath = path.join(
    __dirname,
    "../../outputs/generated-scripts",
    videoId,
    "script.txt"
  );

  if (!fs.existsSync(srtPath)) {
    console.error("❌ Không tìm thấy SRT:", srtPath);
    process.exit(1);
  }
  if (!fs.existsSync(promptPath)) {
    console.error("❌ Không tìm thấy prompt:", promptPath);
    process.exit(1);
  }
  if (!fs.existsSync(scriptPath)) {
    console.error("❌ Không tìm thấy script:", scriptPath);
    process.exit(1);
  }

  const scriptJsonPath = path.join(
    __dirname,
    "../../outputs/search-scene",
    videoId,
    "script.json"
  );

  txtToJson(scriptPath, scriptJsonPath);

  const outputMatchPath = path.join(
    __dirname,
    "../../outputs/search-scene",
    videoId,
    "match.json"
  );

  await searchSceneMatchScriptPrompt(
    scriptJsonPath,
    srtPath,
    promptPath,
    outputMatchPath,
    apiKey
  );
}

main().catch((err) => {
  console.error("❌ Lỗi:", err?.response?.data || err);
});
