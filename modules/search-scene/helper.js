const path = require("path");
const fs = require("fs");

function txtToJson(inputPath, outputPath = null) {
  if (!fs.existsSync(inputPath)) {
    console.error("❌ Không tìm thấy file:", inputPath);
    return;
  }
  //make output path if not exist
  if (!fs.existsSync(path.dirname(outputPath))) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  }

  const text = fs.readFileSync(inputPath, "utf-8");

  // Split text into sentences (basic sentence tokenizer)
  function splitIntoSentences(input) {
    // Normalize whitespace
    const normalized = input.replace(/\s+/g, " ").trim();
    if (!normalized) return [];

    // Match sentences including trailing punctuation and possible closing quotes/brackets
    // This is a lightweight regex and won't handle every edge-case (e.g., some abbreviations),
    // but works well for typical subtitle/transcript text.
    const sentenceRegex = /[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g;
    const matches = normalized.match(sentenceRegex) || [];
    return matches.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  const sentences = splitIntoSentences(text);

  const jsonArray = sentences.map((sentence, idx) => ({
    scriptIdx: idx,
    content: sentence,
  }));

  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(jsonArray, null, 2), "utf-8");
    console.log(`✅ Đã lưu JSON tại: ${outputPath}`);
  }

  return jsonArray;
}

module.exports = { txtToJson };
