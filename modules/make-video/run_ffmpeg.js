#!/usr/bin/env node

/**
 * Make final video from cut-plan JSON:
 * - For each item: cut video by timeline and mux with the item's audio file
 * - Clamp segment times to video duration (avoid zero-packet outputs)
 * - Normalize all segments to the same resolution/fps/pixel format before concat
 * - If audio is longer than the total video cuts, pad the video using tpad=clone
 * - If after clamping there is no usable video, fallback to black video of audio duration
 * - Then concat all outputs into a single final video
 *
 * Usage:
 *   node run_ffmpeg.js <videoId> <inputVideo> [--keep-temp]
 *
 * Requirements:
 *   - ffmpeg & ffprobe must be available in PATH
 */

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

function die(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    die(`Không đọc được JSON: ${p}\n${e.message}`);
  }
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}
function sec(n) {
  return String(round3(n));
}

function runFFmpeg(args, title = "ffmpeg") {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    p.stdout.on("data", (d) => process.stdout.write(`[${title}] ${d}`));
    p.stderr.on("data", (d) => process.stderr.write(`[${title}] ${d}`));
    p.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${title} exited with code ${code}`))
    );
  });
}

/* ---------- Probe helpers ---------- */
const _probeCache = { video: null };

function ffprobeStream(input) {
  return spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,avg_frame_rate,pix_fmt,sample_aspect_ratio",
      "-of",
      "json",
      input,
    ],
    { encoding: "utf8" }
  );
}
function ffprobeFormatDuration(input) {
  return spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      input,
    ],
    { encoding: "utf8" }
  );
}

function getVideoProps(inputVideo) {
  if (_probeCache.video && _probeCache.video.path === inputVideo)
    return _probeCache.video;

  // duration
  const prDur = ffprobeFormatDuration(inputVideo);
  if (prDur.status !== 0)
    die(
      `ffprobe không đọc được duration video: ${inputVideo}\n${
        prDur.stderr || ""
      }`
    );
  const dur = parseFloat((prDur.stdout || "").trim());
  if (!Number.isFinite(dur) || dur <= 0)
    die(`Duration video không hợp lệ: ${inputVideo} -> ${prDur.stdout}`);

  // width/height/fps
  const pr = ffprobeStream(inputVideo);
  let w = 1280,
    h = 720,
    fps = 30;
  if (pr.status === 0 && pr.stdout) {
    try {
      const info = JSON.parse(pr.stdout);
      const s = info.streams && info.streams[0];
      if (s) {
        if (Number.isFinite(s.width)) w = s.width;
        if (Number.isFinite(s.height)) h = s.height;
        if (s.avg_frame_rate && s.avg_frame_rate.includes("/")) {
          const [num, den] = s.avg_frame_rate.split("/").map(Number);
          if (den && Number.isFinite(num) && Number.isFinite(den))
            fps = Math.max(1, Math.round(num / den));
        }
      }
    } catch {}
  }

  // đảm bảo chẵn (tránh lỗi x264 mod2)
  if (w % 2) w += 1;
  if (h % 2) h += 1;

  _probeCache.video = { path: inputVideo, duration: round3(dur), w, h, fps };
  return _probeCache.video;
}

function getAudioDurationSec(itemDuration, audioPath) {
  if (Number.isFinite(itemDuration) && itemDuration > 0)
    return round3(itemDuration);
  const pr = ffprobeFormatDuration(audioPath);
  if (pr.status === 0 && pr.stdout) {
    const dur = parseFloat(pr.stdout.trim());
    if (Number.isFinite(dur) && dur > 0) return round3(dur);
  }
  console.warn(
    `⚠️  Không đọc được duration bằng ffprobe cho audio: ${audioPath}`
  );
  return NaN;
}

/* ---------- Timeline utils ---------- */
function clampTimelineToVideo(timeline, videoDur, scriptIdx) {
  const MIN_LEN = 0.01; // 10ms
  const cleaned = [];
  for (const seg of timeline || []) {
    let s = Number(seg.start);
    let e = Number(seg.end);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;

    s = Math.max(0, Math.min(s, videoDur));
    e = Math.max(0, Math.min(e, videoDur));

    if (e - s < MIN_LEN) {
      console.log(
        `ℹ️  scriptIdx=${scriptIdx}: bỏ đoạn quá ngắn sau clamp: [${s} -> ${e}]`
      );
      continue;
    }
    cleaned.push({ start: round3(s), end: round3(e), text: seg.text ?? "" });
  }
  cleaned.sort((a, b) => a.start - b.start);
  return cleaned;
}
function sumSpan(tl) {
  return round3(
    (tl || []).reduce((a, c) => a + Math.max(0, c.end - c.start), 0)
  );
}

/* ---------- Build normalization chain ---------- */
function normChain(w, h, fps) {
  // Giữ tỷ lệ, pad về đúng kích thước, unify SAR/pix_fmt/fps
  return (
    `scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
    `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,` +
    `setsar=1,format=yuv420p,fps=${fps}`
  );
}

/* ---------- Render a single item ---------- */
async function renderItemClip(item, inputVideo, outFile, idxLog) {
  const audioPath = path.normalize(item.file_path || "");
  if (!fs.existsSync(audioPath))
    throw new Error(
      `Không thấy audio file: ${audioPath} (scriptIdx=${item.scriptIdx})`
    );

  const { duration: videoDur, w, h, fps } = getVideoProps(inputVideo);
  let timeline = Array.isArray(item.timeline) ? item.timeline : [];
  timeline = clampTimelineToVideo(timeline, videoDur, item.scriptIdx);

  let videoSpan = sumSpan(timeline);
  const audioDur = getAudioDurationSec(item.duration, audioPath);
  const needPad = Number.isFinite(audioDur) && audioDur > videoSpan;
  const pad = needPad ? round3(audioDur - videoSpan) : 0;

  // Fallback: không còn đoạn hợp lệ
  if (timeline.length === 0 || videoSpan <= 0) {
    const fallbackDur = Number.isFinite(audioDur) ? audioDur : 1.0;
    console.log(
      `⚠️  scriptIdx=${item.scriptIdx}: timeline trống sau clamp. Dùng video nền đen ${fallbackDur}s.`
    );
    const args = [
      "-y",
      "-f",
      "lavfi",
      "-t",
      sec(fallbackDur),
      "-r",
      String(fps),
      "-i",
      `color=black:s=${w}x${h}:r=${fps}`,
      "-i",
      audioPath,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-shortest",
      outFile,
    ];
    await runFFmpeg(args, `clip:${idxLog}`);
    return;
  }

  const norm = normChain(w, h, fps);

  if (timeline.length === 1) {
    const { start, end } = timeline[0];
    // single: vẫn normalize bằng -vf (và thêm tpad nếu cần)
    const vf =
      pad > 0 ? `${norm},tpad=stop_mode=clone:stop_duration=${sec(pad)}` : norm;
    const args = [
      "-y",
      "-ss",
      sec(start),
      "-to",
      sec(end),
      "-i",
      inputVideo,
      "-i",
      audioPath,
      "-vf",
      vf,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-shortest",
      outFile,
    ];
    if (pad > 0)
      console.log(
        `ℹ️  scriptIdx=${item.scriptIdx}: audio dài hơn video ${sec(
          pad
        )}s -> pad bằng tpad.`
      );
    await runFFmpeg(args, `clip:${idxLog}`);
    return;
  }

  // Multi: normalize mỗi segment rồi concat
  const filterParts = [];
  timeline.forEach((c, i) => {
    filterParts.push(
      `[0:v]trim=start=${sec(c.start)}:end=${sec(
        c.end
      )},setpts=PTS-STARTPTS,${norm}[v${i}]`
    );
  });
  const vLabels = timeline.map((_, i) => `[v${i}]`).join("");
  filterParts.push(`${vLabels}concat=n=${timeline.length}:v=1:a=0[vcat]`);
  if (pad > 0) {
    filterParts.push(
      `[vcat]tpad=stop_mode=clone:stop_duration=${sec(pad)}[vout]`
    );
    console.log(
      `ℹ️  scriptIdx=${item.scriptIdx}: audio dài hơn video ${sec(
        pad
      )}s -> pad bằng tpad sau concat.`
    );
  }

  const ffArgs = [
    "-y",
    "-i",
    inputVideo,
    "-i",
    audioPath,
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    pad > 0 ? "[vout]" : "[vcat]",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-shortest",
    outFile,
  ];
  await runFFmpeg(ffArgs, `clip:${idxLog}`);
}

/* ---------- Concat all temp clips ---------- */
async function concatClipsReencode(tempFiles, finalOutput) {
  const listPath = path.join(
    path.dirname(finalOutput),
    `concat_${Date.now()}.txt`
  );
  const lines = tempFiles
    .map((f) => `file '${f.replace(/'/g, "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(listPath, lines, "utf8");

  const args = [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    finalOutput,
  ];
  try {
    await runFFmpeg(args, "concat");
  } finally {
    try {
      fs.unlinkSync(listPath);
    } catch {}
  }
}

/* ---------- Main ---------- */
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2)
    die("Usage: node run_ffmpeg.js <video-id> <inputVideo> [--keep-temp]");
  const videoId = args[0];
  const inputVideo = args[1];
  const keepTemp = args.includes("--keep-temp");

  const planPath = path.join(
    __dirname,
    "../../outputs/make-video",
    videoId,
    `${videoId}.json`
  );
  if (!fs.existsSync(planPath)) die(`Không tìm thấy plan: ${planPath}`);
  if (!fs.existsSync(inputVideo))
    die(`Không tìm thấy video gốc: ${inputVideo}`);

  const plan = readJson(planPath);
  if (!Array.isArray(plan) || plan.length === 0)
    die("Plan JSON rỗng hoặc không đúng định dạng mảng.");

  const finalOutput = path.join(
    __dirname,
    "../../outputs/make-video",
    videoId,
    "output.mp4"
  );

  const workDir = path.dirname(path.resolve(finalOutput));
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });
  const tmpDir = path.join(workDir, "_tmp_segments");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const tempFiles = [];
  try {
    // Pre-probe & cache props
    getVideoProps(inputVideo);

    for (let i = 0; i < plan.length; i++) {
      const item = plan[i];
      const outFile = path.join(
        tmpDir,
        `seg_${String(i).padStart(4, "0")}.mp4`
      );
      console.log(
        `\n=== Render clip ${i + 1}/${plan.length} (scriptIdx=${
          item.scriptIdx
        }) -> ${outFile}`
      );
      await renderItemClip(
        item,
        inputVideo,
        outFile,
        `${i + 1}/${plan.length}`
      );
      tempFiles.push(outFile);
    }

    console.log(`\n=== Concat ${tempFiles.length} clips -> ${finalOutput}`);
    await concatClipsReencode(tempFiles, finalOutput);

    console.log(`\n✅ Hoàn tất: ${finalOutput}`);
  } catch (e) {
    console.error("\n❌ Lỗi:", e.message);
    process.exit(1);
  } finally {
    if (!keepTemp) {
      try {
        for (const f of tempFiles) {
          try {
            fs.unlinkSync(f);
          } catch {}
        }
        fs.rmdirSync(tmpDir);
      } catch {}
    } else {
      console.log(`ℹ️ Giữ lại thư mục tạm: ${tmpDir}`);
    }
  }
}

if (require.main === module) {
  main();
}
