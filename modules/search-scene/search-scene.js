const dotenv = require("dotenv");
dotenv.config();

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

async function searchSceneMatchScript(
  scriptPath,
  srtPath,
  aiKey = process.env.GEMINI_API_KEY,
  model = "gemini-2.5-flash"
) {}

module.exports = { searchSceneMatchScript };
