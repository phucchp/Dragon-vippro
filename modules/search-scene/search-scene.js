const dotenv = require("dotenv");
dotenv.config();

const {
  GoogleGenerativeAI,
  GenerativeModel,
  SchemaType,
} = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const { uploadFileGemini } = require("./helper");

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

const sceneMatchSchema = {
  description: " A list of script and corresponding timeline",
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      scriptIdx: { type: SchemaType.NUMBER },
      scriptContent: { type: SchemaType.STRING },
      timeline: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            start: { type: SchemaType.NUMBER },
            end: { type: SchemaType.NUMBER },
            text: { type: SchemaType.STRING },
          },
        },
      },
    },
    required: ["scriptIdx", "scriptContent", "timeline"],
  },
};
const summarySchema = {
  description: "A list of video segments",
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      start: { type: SchemaType.NUMBER },
      end: { type: SchemaType.NUMBER },
      text: { type: SchemaType.STRING },
    },
    required: ["start", "end", "text"],
  },
};

async function searchSceneMatchScriptPrompt(
  scriptPath,
  srtPath,
  promptPath,
  outputPath,
  apiKey = process.env.GEMINI_API_KEY,
  model_name = "gemini-2.5-flash"
) {
  // 1. upload file to gemini
  const uploadedFile = await uploadFileGemini(apiKey, srtPath, "text/plain");
  console.log("uploadedFile: ", uploadedFile);
  // const uploadedFile = {
  //   uri: "https://generativelanguage.googleapis.com/v1beta/files/6witqiazjvcr",
  //   mimeType: "application/json",
  // };
  //2. call gemini
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: model_name,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      // maxOutputTokens: 50000,
      responseMimeType: "application/json",
      responseSchema: sceneMatchSchema,
    },
  });

  const prompt = fs.readFileSync(promptPath, "utf8");
  const scriptContent = fs.readFileSync(scriptPath, "utf8");
  const fullPrompt = prompt.replace(
    "{{SCRIPT_SENTENCE}}:",
    `SCRIPT_SENTENCE: ${scriptContent}`
  );
  const srtPart = {
    fileData: {
      fileUri: uploadedFile.uri,
      mimeType: uploadedFile.mimeType,
    },
  };
  const userChunkParts = [{ text: fullPrompt }, srtPart];

  // const promptLength = await model.countTokens(userChunkParts);
  // console.log("promptLength: ", promptLength);

  const response = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: userChunkParts,
      },
    ],
  });
  console.log("token: ", response?.response?.usageMetadata);
  const matchResult = JSON.parse(response?.response.text());
  fs.writeFileSync(outputPath, JSON.stringify(matchResult, null, 2), "utf8");
  return matchResult;
}

module.exports = {
  searchSceneMatchScriptPrompt,
  searchSceneMatchScriptEmbedding,
};
