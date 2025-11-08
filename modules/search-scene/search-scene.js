const dotenv = require("dotenv");
dotenv.config();

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

async function searchSceneMatchScriptEmbedding(
  scriptPath,
  srtPath,
  aiKey = process.env.GEMINI_API_KEY,
  model = "gemini-2.5-flash",
  dim = 768
) {
  const srtVectors = await embedSrt(srtPath, aiKey);
  const scriptVectors = await embedScript(scriptPath, aiKey);
  //match
  const TOP_K = 10;
}

async function embedSrt(srtPath, aiKey = process.env.GEMINI_API_KEY) {}
async function embedScript(scriptPath, aiKey = process.env.GEMINI_API_KEY) {}

async function searchSceneMatchScriptPrompt(
  scriptPath,
  srtPath,
  promptPath,
  outputPath,
  aiKey = process.env.GEMINI_API_KEY,
  model = "gemini-2.5-flash"
) {
  const genAI = new GoogleGenerativeAI(aiKey);
  const model = genAI.getGenerativeModel({ model });
  const prompt = fs.readFileSync(promptPath, "utf8");
  const srtContent = fs.readFileSync(srtPath, "utf8");
  const scriptContent = fs.readFileSync(scriptPath, "utf8");
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text().trim();
  fs.writeFileSync(outputPath, text, "utf8");
}

module.exports = {
  searchSceneMatchScriptPrompt,
  searchSceneMatchScriptEmbedding,
};
