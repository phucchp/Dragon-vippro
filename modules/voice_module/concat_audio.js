#!/usr/bin/env node
/**
 * Join audios from JSON (uses file_path fields) in order of the array (or scriptIdx).
 * Usage:
 *   node join_audio_from_json.js /path/to/matched_and_timeline.json out_audio.mp3 [--by=scriptIdx] [--copy]
 *
 * Flags:
 *   --by=scriptIdx    : sort by scriptIdx asc (default: keep original order in JSON)
 *   --copy            : -c copy (no re-encode). Fails if codecs don't match. If omitted, re-encodes to mp3 192k.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function die(msg) {
  console.error(msg);
  process.exit(1);
}
function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function pickFilePaths(json) {
  if (!Array.isArray(json)) die("JSON phải là mảng item.");
  // item cấp 1 có { file_path, ... }
  // (nếu JSON của bạn là mảng phẳng các segment không có file_path, thì cách này không áp dụng)
  const out = [];
  for (const it of json) {
    if (!it) continue;
    if (it.file_path && typeof it.file_path === "string")
      out.push({
        file_path: it.file_path,
        scriptIdx: it.scriptIdx ?? it.idx ?? 0,
      });
  }
  if (out.length === 0)
    die("Không tìm thấy trường 'file_path' nào trong JSON.");
  return out;
}

function main() {
  const jsonPath = process.argv[2];
  const outPath = process.argv[3];
  const by = (
    process.argv.find((a) => a.startsWith("--by=")) || "--by=order"
  ).split("=")[1];
  const useCopy = process.argv.includes("--copy");

  if (!jsonPath || !outPath) {
    die(
      "Usage: node join_audio_from_json.js matched.json out.mp3 [--by=scriptIdx] [--copy]"
    );
  }
  if (!exists(jsonPath)) die(`Không tìm thấy JSON: ${jsonPath}`);

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  let items = pickFilePaths(data);

  // sort
  if (by === "scriptIdx") {
    items.sort((a, b) => (a.scriptIdx || 0) - (b.scriptIdx || 0));
  } // else: giữ nguyên thứ tự trong JSON

  // validate & absolutize
  const files = items.map((it, i) => {
    const p = path.resolve(it.file_path);
    if (!exists(p)) die(`Không thấy audio: ${p} (item #${i})`);
    return p;
  });

  // Tạo list file cho concat demuxer
  const tmpDir = path.join(process.cwd(), ".join_tmp");
  if (!exists(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const listPath = path.join(tmpDir, "list.txt");
  const lines = files
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(listPath, lines, "utf8");

  // Gọi ffmpeg concat
  // - Nếu --copy: concat "stream copy" (rất nhanh, yêu cầu cùng codec/rate/channels)
  // - Nếu không: re-encode toàn bộ sang mp3 192k (an toàn, chậm hơn)
  const args = [
    "-hide_banner",
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
  ];
  if (useCopy) {
    args.push("-c", "copy");
  } else {
    args.push("-c:a", "libmp3lame", "-b:a", "192k", "-ar", "48000", "-ac", "2");
  }
  args.push(outPath);

  console.log("> ffmpeg", args.join(" "));
  const r = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (r.error) die(r.error.message);
  if (r.status !== 0) {
    if (useCopy) {
      console.error(
        "❌ concat -c copy thất bại (thường do codec không đồng nhất). Thử lại KHÔNG dùng --copy (để re-encode)."
      );
    }
    process.exit(r.status);
  }

  console.log(`✅ Done: ${path.resolve(outPath)}`);
}

main();

// # Nhanh, không re-encode (yêu cầu tất cả audio cùng codec/rate/channels):
// node concat_audio.js ..\\..\\outputs\\voice\\video-1\\scenes_script_voice.json all.mp3 --by=scriptIdx --copy

// # An toàn (re-encode về MP3 192k 48kHz stereo):
// node concat_audio.js matched_and_timeline.json all.mp3 --by=scriptIdx
