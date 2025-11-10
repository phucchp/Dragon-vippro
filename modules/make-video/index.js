#!/usr/bin/env node
/**
 * Build cut plan per audio duration from matched scene timelines.
 *
 * Usage:
 *   node index.js <videoId>
 *
 * Input:
 *   - ../../outputs/voice/<videoId>/scenes_script_voice.json
 *     (mỗi item: { scriptIdx, content, idx, duration, file_path })
 *   - ../../outputs/search-scene/<videoId>/match.json
 *     (mỗi item: { scriptIdx, scriptContent, timeline: [{start,end,text}] })
 *
 * Output:
 *   - ../../outputs/make-video/<videoId>/<videoId>.json
 */

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    die("Usage: node index.js <videoId>");
  }
  const videoId = args[0];
  return { videoId };
}

function die(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

function readJson(p) {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

/**
 * Pick consecutive segments so that total length == duration (or as close as possible).
 * - If duration < first segment length -> take partial of the first.
 * - If duration > sum of all segments -> take all possible (trả về remaining > 0).
 */
function pickSegmentsByDuration(duration, segments) {
  let remaining = Math.max(0, duration);
  const picked = [];

  for (const seg of segments) {
    if (remaining <= 0) break;
    const segLen = Math.max(0, (seg.end ?? 0) - (seg.start ?? 0));
    if (segLen <= 0) continue;

    const take = Math.min(remaining, segLen);
    const start = seg.start;
    const end = start + take;

    picked.push({
      start: round3(start),
      end: round3(end),
      text: seg.text ?? "",
    });

    remaining = round3(remaining - take);
  }

  return { picked, remaining };
}

/**
 * FFmpeg:
 * - 1 cut: -ss/-to + audio ngoài
 * - nhiều cut: trim/atrim + concat, rồi map audio ngoài
 */
function makeFfmpegCommands(scriptIdx, cuts, audioPath) {
  const outName = `out_${scriptIdx}.mp4`;
  const srcVideo = "INPUT_VIDEO"; // thay bằng path video thật khi chạy
  const audio = (audioPath || "").replace(/\\/g, "/");

  if (!cuts || cuts.length === 0) return {};

  if (cuts.length === 1) {
    const c = cuts[0];
    const cmd = [
      `ffmpeg -y`,
      `-ss ${c.start} -to ${c.end} -i "${srcVideo}"`,
      `-i "${audio}"`,
      `-map 0:v:0 -map 1:a:0 -c:v libx264 -c:a aac -shortest`,
      outName,
    ].join(" ");
    return { ffmpeg_simple: cmd };
  }

  const filters = [];
  cuts.forEach((c, i) => {
    filters.push(
      `[0:v]trim=start=${c.start}:end=${c.end},setpts=PTS-STARTPTS[v${i}]`
    );
    filters.push(
      `[0:a]atrim=start=${c.start}:end=${c.end},asetpts=PTS-STARTPTS[a${i}]`
    );
  });
  const vLabels = cuts.map((_, i) => `[v${i}]`).join("");
  const aLabels = cuts.map((_, i) => `[a${i}]`).join("");
  filters.push(
    `${vLabels}${aLabels}concat=n=${cuts.length}:v=1:a=1[vcat][acat]`
  );

  const cmd = [
    `ffmpeg -y -i "${srcVideo}" -i "${audio}"`,
    `-filter_complex "${filters.join(";")}"`,
    `-map "[vcat]" -map 1:a:0 -c:v libx264 -c:a aac -shortest`,
    outName,
  ].join(" ");

  return { ffmpeg_concat_filter: cmd };
}

function main() {
  const { videoId } = parseArgs();

  // ====== 1. Build default paths from videoId ======
  const sceneScriptVoicePath = path.join(
    __dirname,
    "../../outputs/voice",
    videoId,
    `scenes_script_voice.json`
  );

  const matchesPath = path.join(
    __dirname,
    "../../outputs/search-scene",
    videoId,
    `match.json`
  );

  const outPath = path.join(
    __dirname,
    "../../outputs/make-video",
    videoId,
    `${videoId}.json`
  );

  if (!fs.existsSync(sceneScriptVoicePath))
    die(`Không tìm thấy scripts JSON: ${sceneScriptVoicePath}`);
  if (!fs.existsSync(matchesPath))
    die(`Không tìm thấy matches JSON: ${matchesPath}`);

  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // ====== 2. Đọc file ======
  const scripts = readJson(sceneScriptVoicePath);
  const matches = readJson(matchesPath);
  console.log("scripts length: ", scripts.length);
  console.log("matches length: ", matches.length);

  // Lập chỉ mục theo scriptIdx trong matches
  const matchByIdx = new Map();
  for (const m of matches) matchByIdx.set(m.scriptIdx, m);

  const results = [];
  const infos = [];

  // ====== 3. Build plan ======
  for (const s of scripts) {
    const { scriptIdx, duration, file_path } = s;
    const m = matchByIdx.get(scriptIdx);

    if (!m || !Array.isArray(m.timeline) || m.timeline.length === 0) {
      //previouse item's end timeline + duration
      const prev = results[results.length - 1];
      const prevEnd = prev.timeline[prev.timeline.length - 1].end;
      const newStart = prevEnd;
      const newEnd = newStart + duration;
      results.push({
        ...s,
        timeline: [{ start: newStart, end: newEnd, text: "" }],
        note: "No timeline found for this scriptIdx",
      });
      // results.push({
      //   ...s,
      //   timeline: [],
      // note: "No timeline found for this scriptIdx",
      // });
      continue;
    }

    const cleaned = m.timeline
      .filter(
        (t) =>
          Number.isFinite(t.start) && Number.isFinite(t.end) && t.end > t.start
      )
      .sort((a, b) => a.start - b.start);

    const { picked, remaining } = pickSegmentsByDuration(duration, cleaned);

    // === SỬA THEO YÊU CẦU: nếu audio dài hơn tổng timeline => cộng phần thiếu vào đoạn CUỐI ===
    let extendedBy = 0;
    if (remaining > 0 && picked.length > 0) {
      const last = picked[picked.length - 1];
      last.end = round3(last.end + remaining);
      extendedBy = remaining;
    }

    // Ghi chú/ghi log để biết đã extend bao nhiêu
    if (extendedBy > 0) {
      infos.push(
        `ℹ️ scriptIdx=${scriptIdx}: audio dài hơn timeline, đã cộng thêm ${extendedBy}s vào đoạn cuối (${round3(
          picked[picked.length - 1].start
        )} -> ${round3(picked[picked.length - 1].end)})`
      );
    }

    const cmds = makeFfmpegCommands(scriptIdx, picked, file_path || "");

    results.push({
      ...s,
      timeline: picked,
      extended_last_segment_by: extendedBy > 0 ? extendedBy : undefined,
      ffmpeg_command:
        picked.length <= 1 ? "ffmpeg_simple" : "ffmpeg_concat_filter",
      ...cmds,
    });
  }

  // ====== 4. Ghi file ======
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");

  console.log(`✅ Đã tạo kế hoạch cắt: ${path.resolve(outPath)}`);
  if (infos.length) {
    console.log("\n--- Info ---");
    infos.forEach((i) => console.log(i));
  }
}

if (require.main === module) {
  main();
}
