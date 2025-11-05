# 1. Read file json 
# 2. tts each item (from text to audio, not care about start/end)
# 3. get duration of each item's audio
# 4. write to file json (start, end, content, duration, file_path)
# 5. can use in command line
    # - input: json file
    # - output: json file (with duration and file_path)
    # - voice: vi-VN-HoaiMyNeural
    # - rate: +0%
    # - volume: +0%
    # - retries: 3
    # - backoff_ms: 800
    # - concurrency: 3
    # - out_dir: out
import json
import asyncio
import edge_tts
import os
import sys
import io
from pydub import AudioSegment
import argparse
import time 

async def tts_bytes(text: str, voice: str, rate: str, volume: str, retries: int = 3, backoff_ms: int = 800) -> bytes:
    """
    Gen audio (mp3 bytes) from text.
    """
    attempt = 0
    while True:
        try:
            out = io.BytesIO()
            comm = edge_tts.Communicate(text, voice=voice, rate=rate, volume=volume)
            got = False
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    out.write(chunk["data"])
                    got = True
            if not got:
                raise RuntimeError("No audio was received from TTS")
            return out.getvalue()
        except Exception as e:
            attempt += 1
            if attempt > retries:
                raise
            time.sleep(backoff_ms / 1000.0)
            backoff_ms *= 2
            print(f"[WARN] TTS retry #{attempt} ({e})")
            
async def get_duration(audio_bytes: bytes) -> float:
    seg = AudioSegment.from_file(io.BytesIO(audio_bytes), format="mp3")
    return len(seg) / 1000.0

async def process_item(item: dict, voice: str, rate: str, volume: str, out_dir: str) -> dict:
    audio_bytes = await tts_bytes(item["content"], voice, rate, volume)
    duration = await get_duration(audio_bytes)
    file_path = os.path.join(out_dir, f"{item['idx']}.mp3")
    with open(file_path, "wb") as f:
        f.write(audio_bytes)
    item["duration"] = duration
    item["file_path"] = file_path
    return item

async def main(input_file: str, output_file: str, voice: str, rate: str, volume: str, out_dir: str):
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)
        for item in data:
            if "content" not in item:
                raise ValueError(f"Missing 'content' in item: {item}")
            item["idx"] = data.index(item)
    tasks = [process_item(item, voice, rate, volume, out_dir) for item in data]
    results = await asyncio.gather(*tasks)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("input_file", help="Input json file")
    parser.add_argument("output_file", help="Output json file")
    parser.add_argument("--voice", default="vi-VN-HoaiMyNeural", help="Voice")
    parser.add_argument("--rate", default="+0%", help="Rate")
    parser.add_argument("--volume", default="+0%", help="Volume")
    parser.add_argument("--out_dir", default="out", help="Output directory")
    args = parser.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)
    print(f"[INFO] Input: {args.input_file}")
    asyncio.run(main(args.input_file, args.output_file, args.voice, args.rate, args.volume, args.out_dir))

# command: python tts.py test.json output.json --voice vi-VN-HoaiMyNeural --rate +0% --volume +0% --out_dir out
# sample input: [{"content": "Hello world"}, {"content": "Hello world 2"}]