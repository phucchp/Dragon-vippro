import json
import re
import sys
import argparse
from pathlib import Path
from datetime import timedelta

from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound


def extract_video_id(url_or_id: str) -> str:
    # nếu đưa thẳng ID thì trả luôn
    if re.fullmatch(r"[0-9A-Za-z_-]{6,}", url_or_id):
        return url_or_id

    m = re.search(r"v=([0-9A-Za-z_-]{6,})", url_or_id)
    if m:
        return m.group(1)

    m = re.search(r"youtu\.be/([0-9A-Za-z_-]{6,})", url_or_id)
    if m:
        return m.group(1)

    raise ValueError("Không lấy được video_id từ: " + url_or_id)


def to_srt_timestamp(seconds: float) -> str:
    td = timedelta(seconds=seconds)
    total_ms = int(td.total_seconds() * 1000)
    hours, rem = divmod(total_ms, 3600 * 1000)
    minutes, rem = divmod(rem, 60 * 1000)
    secs, ms = divmod(rem, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{ms:03}"


def choose_transcript(ytt: YouTubeTranscriptApi, video_id: str, langs: list[str] | None):
    """
    - Nếu truyền langs → cố tìm đúng langs
    - Nếu không truyền → ưu tiên sub thường (manually), không có thì lấy auto
    """
    transcript_list = ytt.list(video_id)

    # Trường hợp người dùng truyền --lang
    if langs:
        # ví dụ --lang vi,en  -> ['vi', 'en']
        try:
            return transcript_list.find_transcript(langs)
        except NoTranscriptFound:
            # fallback nhẹ: thử generated
            try:
                return transcript_list.find_generated_transcript(langs)
            except NoTranscriptFound:
                raise

    # Không truyền ngôn ngữ → tự chọn
    # 1) ưu tiên sub người up (manually) bằng các ngôn ngữ phổ biến
    common_langs = ["vi", "en", "en-US", "en-GB"]
    try:
        return transcript_list.find_manually_created_transcript(common_langs)
    except NoTranscriptFound:
        # 2) không có thì lấy auto
        return transcript_list.find_generated_transcript(common_langs)


def main():
    parser = argparse.ArgumentParser(description="Download YouTube transcript và lưu ra txt/json/srt")
    parser.add_argument("url_or_id", help="YouTube URL hoặc video id")
    parser.add_argument(
        "--lang",
        help="Danh sách ngôn ngữ ưu tiên, ví dụ: --lang vi,en hoặc --lang en",
    )
    args = parser.parse_args()

    video_id = extract_video_id(args.url_or_id)

    # tách lang nếu có
    langs = None
    if args.lang:
        langs = [x.strip() for x in args.lang.split(",") if x.strip()]

    ytt = YouTubeTranscriptApi()

    try:
        transcript = choose_transcript(ytt, video_id, langs)
    except NoTranscriptFound:
        print("❌ Không tìm được transcript phù hợp.")
        sys.exit(1)

    fetched = transcript.fetch()
    raw_data = fetched.to_raw_data()  # [{'text','start','duration'}, ...]

    out_dir = Path(f"../../outputs/downloaded-subtitles/{video_id}")
    out_dir.mkdir(parents=True, exist_ok=True)

    txt_path = out_dir / f"{video_id}.txt"
    json_path = out_dir / f"{video_id}.json"
    srt_path = out_dir / f"{video_id}.srt"

    # 1) TXT
    with txt_path.open("w", encoding="utf-8") as f:
        for item in raw_data:
            f.write((item["text"] or "").strip() + "\n")

    # 2) JSON
    with json_path.open("w", encoding="utf-8") as f:
        json.dump(raw_data, f, ensure_ascii=False, indent=2)

    # 3) SRT
    with srt_path.open("w", encoding="utf-8") as f:
        for idx, item in enumerate(raw_data, start=1):
            start = item["start"]
            duration = item["duration"]
            end = start + duration

            f.write(f"{idx}\n")
            f.write(f"{to_srt_timestamp(start)} --> {to_srt_timestamp(end)}\n")
            text = (item["text"] or "").strip()
            f.write(text + "\n\n")

    print("✅ Đã lưu:")
    print(f"- {txt_path}")
    print(f"- {json_path}")
    print(f"- {srt_path}")


if __name__ == "__main__":
    main()
