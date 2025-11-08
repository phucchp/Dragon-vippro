const path = require("path");
const fs = require("fs");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

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

class FileUploader {
  initGoogleFileManager(apiKey) {
    return new GoogleAIFileManager(apiKey);
  }

  async checkFileStatus(apiKey, fileId) {
    const fileManager = this.initGoogleFileManager(apiKey);
    let status = "PROCESSING";
    const maxRetries = 12; // Số lần thử tối đa (5 giây x 12 = 60 giây)
    let attempts = 0;

    while (status === "PROCESSING" && attempts < maxRetries) {
      const fileStatus = await fileManager.getFile(fileId);
      status = fileStatus.state;

      if (status === "ACTIVE") {
        return; // File đã sẵn sàng
      }

      if (status === "FAILED") {
        throw new InternalServerErrorException(
          `File processing failed for file ID: ${fileId}`
        );
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Chờ 5 giây trước khi thử lại
    }

    // Nếu vòng lặp kết thúc mà file chưa chuyển sang trạng thái 'ACTIVE', báo lỗi
    if (status !== "ACTIVE") {
      throw new InternalServerErrorException(
        `File processing timed out for file ID: ${fileId}. Last known state: ${status}`
      );
    }
  }

  async uploadFile(apiKey, path, mimeType) {
    if (!apiKey || !path || !mimeType) {
      throw new Error("API key, file path, and MIME type are required.");
    }
    const fileManager = this.initGoogleFileManager(apiKey);
    const uploadResult = await fileManager.uploadFile(path, {
      mimeType,
      displayName: path,
    });

    const file = uploadResult.file;
    await this.checkFileStatus(apiKey, file.name);
    const fileStatus = await fileManager.getFile(file.name);
    return fileStatus;
  }
}

async function uploadFileGemini(apiKey, filePath, mimeType) {
  const uploader = new FileUploader();

  try {
    const uploadedFile = await uploader.uploadFile(apiKey, filePath, mimeType);
    console.log("File uploaded successfully:", uploadedFile);
    return uploadedFile;
  } catch (error) {
    console.error("Error uploading file:", error.message);
  }
}

module.exports = { txtToJson, uploadFileGemini };
