const dotenv = require("dotenv");
dotenv.config();

const { GoogleGenerativeAI } = require("@google/generative-ai");
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

const zod = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
const sceneMatchSchema = zod.array(
  zod.object({
    scriptIdx: zod.number(),
    timeline: zod.array(
      zod.object({
        start: zod.number(),
        end: zod.number(),
        text: zod.string(),
      })
    ),
  })
);

async function searchSceneMatchScriptPrompt(
  scriptPath,
  srtPath,
  promptPath,
  outputPath,
  apiKey = process.env.GEMINI_API_KEY,
  model_name = "gemini-2.5-pro"
) {
  //1. upload file to gemini
  const uploadedFile = await uploadFileGemini(
    apiKey,
    srtPath,
    "application/json"
  );

  //2. call gemini
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: model_name });

  const prompt = fs.readFileSync(promptPath, "utf8");
  const scriptContent = fs.readFileSync(scriptPath, "utf8");
  const fullPrompt = prompt.replace(
    "{{SCRIPT_SENTENCE}}:",
    `SCRIPT_SENTENCE: ${JSON.stringify(scriptContent)}`
  );
  const srtPart = {
    fileData: {
      fileUri: uploadedFile.uri,
      mimeType: uploadedFile.mimeType,
    },
  };
  const userChunkParts = [{ text: fullPrompt }, srtPart];

  const response = await model.generateContent({
    model: model_name,
    contents: [
      {
        role: "user",
        parts: userChunkParts,
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: zodToJsonSchema(sceneMatchSchema),
    },
  });
  const matchResult = sceneMatchSchema.parse(JSON.parse(response.text));
  console.log(matchResult);
  fs.writeFileSync(outputPath, JSON.stringify(matchResult, null, 2), "utf8");
  return matchResult;
}

module.exports = {
  searchSceneMatchScriptPrompt,
  searchSceneMatchScriptEmbedding,
};
