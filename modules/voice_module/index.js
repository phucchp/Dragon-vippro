const fs = require("fs");
const path = require("path");
const exec = require("child_process");

/**
 * Convert text file to JSON format [{ content }]
 * @param {string} inputPath - Đường dẫn file .txt
 * @param {string} [outputPath] - (tuỳ chọn) Đường dẫn file .json
 * @returns {Array} - Mảng JSON kết quả
 */
function txtToJson(inputPath, outputPath = null) {
  // Đọc toàn bộ nội dung file .txt
  const text = fs.readFileSync(inputPath, "utf-8");

  // Tách từng dòng và loại bỏ dòng trống
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Chuyển thành mảng các object {content}
  const jsonArray = lines.map((line, idx) => ({
    scriptIdx: idx,
    content: line,
  }));

  // Nếu có outputPath thì ghi ra file
  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(jsonArray, null, 2), "utf-8");
    console.log(`✅ Đã lưu JSON tại: ${outputPath}`);
  }

  return jsonArray;
}

// // Ví dụ sử dụng
// const result = txtToJson(".", "./output_script.json");
// console.log(result);

// build input path from videoId from cli
function main() {
  const videoId = process.argv[2];
  const inputPath = path.join(
    // __dirname,
    "../../outputs/generated-scripts",
    videoId,
    "script.txt"
  );
  //make output dir if not exist
  const outputDir = path.join(
    // __dirname,
    "../../outputs/voice",
    videoId
  );
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputJsonPath = path.join(
    // __dirname,
    "../../outputs/voice",
    videoId,
    "voice.json"
  );
  txtToJson(inputPath, outputJsonPath);

  // run tts.exe by cli

  const ttsPath = path.join("tts.exe");
  // ./tts.exe ..\\..\\outputs\\voice\\video-1\\voice.json ..\\..\\outputs\\voice\\video-1\\scenes_script_voice.json --voice vi-VN-HoaiMyNeural --rate +0% --volume +0% --out_dir ..\\..\\outputs\\voice\\video-1\\out_voice
  const outputPath = path.join(outputDir, "scenes_script_voice.json");
  const voiceFilePath = path.join(outputDir, "out_voice");

  const command = `${ttsPath} ${outputJsonPath} ${outputPath} --voice vi-VN-HoaiMyNeural --rate +0% --volume +0% --out_dir ${voiceFilePath}`;
  exec.execSync(command);
}

main();
// how to run: node convert_txt2json.js <video_id>

module.exports = { txtToJson };
