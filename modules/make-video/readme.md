# Module: make-video

Hướng dẫn sử dụng module `make-video` để xây dựng kế hoạch cắt video (cut plan) dựa trên audio đã tạo và kết quả tìm kiếm cảnh.

## Mục đích

`modules/make-video` nhận dữ liệu đầu vào từ:

- `outputs/voice/<videoId>/scenes_script_voice.json` — danh sách từng đoạn audio đã tạo (mỗi phần có `scriptIdx`, `duration`, `file_path`, ...)
- `outputs/search-scene/<videoId>/match.json` — kết quả tìm kiếm cảnh tương ứng (mỗi phần có `scriptIdx`, `timeline: [{start,end,text}]`)

Script sẽ chọn các đoạn timeline liên tiếp tương ứng với thời lượng audio rồi sinh ra các lệnh FFmpeg (một hoặc nhiều cut) để xuất file video ngắn kèm audio.

Kết quả ghi ra: `outputs/make-video/<videoId>/<videoId>.json` (một mảng các mục kế hoạch cho từng `scriptIdx`).

## Yêu cầu

- Node.js (>= 12+) — dùng để chạy `index.js`.
- ffmpeg — phải cài đặt và có trong `PATH` để chạy các lệnh xuất video.
- `jq` (tùy chọn) — dùng ở phần ví dụ để trích lệnh từ JSON.

Trên Windows, bạn có thể dùng Git Bash (shell `bash.exe`) hoặc WSL để chạy các lệnh bash/JQ/FFmpeg như trong ví dụ.

## Cách chạy

1. Tạo các file đầu vào (nếu chưa có):

   - `outputs/voice/<videoId>/scenes_script_voice.json`
   - `outputs/search-scene/<videoId>/match.json`

2. Chạy script để sinh kế hoạch cắt (từ thư mục gốc project):

```bash
node modules/make-video/index.js <videoId>
# ví dụ
node modules/make-video/index.js video-1
```

Sau khi chạy xong, bạn sẽ thấy file JSON đầu ra tại `outputs/make-video/<videoId>/<videoId>.json`.

## Nội dung file kết quả

Mỗi phần tử trong mảng là một object giống dạng:

```json
{
  "scriptIdx": 0,
  "content": "...",
  "duration": 3.5,
  "file_path": "path/to/audio.mp3",
  "timeline": [{ "start": 12.34, "end": 14.56, "text": "..." }],
  "ffmpeg_simple": "...", // khi chỉ 1 cut
  "ffmpeg_concat_filter": "..." // khi nhiều cut
}
```

- `ffmpeg_simple`: lệnh FFmpeg cho trường hợp chỉ cần 1 lần cắt (-ss/-to). Lưu ý lệnh sinh ra chứa chuỗi placeholder `INPUT_VIDEO` — bạn phải thay bằng đường dẫn file video gốc thực tế trước khi chạy.
- `ffmpeg_concat_filter`: lệnh FFmpeg dùng filter_complex + concat cho nhiều đoạn; thường có dạng `ffmpeg -y -i "INPUT_VIDEO" -i "<audio>" -filter_complex "..." -map "[vcat]" -map 1:a:0 ...`

`file_path` trong JSON là đường dẫn file audio (được map vào lệnh FFmpeg thứ hai).

## Ví dụ: chạy lệnh FFmpeg từ JSON (bash)

Giả sử file JSON tạo ra là `outputs/make-video/video-1/video-1.json` và video gốc là `/path/to/source.mp4`.

1. Chạy 1 mục (ví dụ `scriptIdx=0`):

```bash
video="/path/to/source.mp4"
json="outputs/make-video/video-1/video-1.json"

# Lấy lệnh (simple hoặc concat) từ mục đầu tiên
cmd=$(jq -r '.[0].ffmpeg_simple // .[0].ffmpeg_concat_filter // empty' "$json")
if [ -z "$cmd" ]; then
	echo "No ffmpeg command found in JSON entry"
	exit 1
fi

# Thay placeholder INPUT_VIDEO bằng đường dẫn thực
cmd=${cmd//INPUT_VIDEO/$video}

echo "Running: $cmd"
eval "$cmd"
```

2. Chạy tất cả các mục có lệnh FFmpeg (ví dụ vòng for đọc từng object):

```bash
video="/path/to/source.mp4"
json="outputs/make-video/video-1/video-1.json"

jq -c '.[]' "$json" | while read -r item; do
	idx=$(echo "$item" | jq -r '.scriptIdx')
	cmd=$(echo "$item" | jq -r '.ffmpeg_simple // .ffmpeg_concat_filter // empty')
	if [ -z "$cmd" ]; then
		echo "skip scriptIdx=$idx (no ffmpeg command)"
		continue
	fi
	cmd=${cmd//INPUT_VIDEO/$video}
	echo "\n--- Running scriptIdx=$idx ---"
	echo "$cmd"
	eval "$cmd"
done
```

Gợi ý: bạn có thể redirect output mỗi lần chạy vào thư mục riêng, hoặc sửa `make-video/index.js` để in thêm tên file output mong muốn.

## Lưu ý & Troubleshooting

- Nếu lệnh FFmpeg báo lỗi liên quan đến đường dẫn audio/video, kiểm tra `file_path` trong JSON và đảm bảo file tồn.
- `INPUT_VIDEO` là placeholder trong lệnh sinh ra; bạn phải thay bằng đường dẫn file video gốc trước khi chạy.
- Nếu các đoạn cắt quá ngắn hoặc bị trùng lặp, kiểm tra `outputs/search-scene/<videoId>/match.json` để đảm bảo timeline hợp lệ.
- Một số môi trường Windows có cách escape khác; nếu gặp vấn đề với dấu ngoặc kép trong lệnh filter_complex, dùng Git Bash hoặc WSL để chạy.

## Nâng cấp đề xuất (tuỳ chọn)

- Tạo script nhỏ (node / bash) tự động thay `INPUT_VIDEO` bằng tham số và chạy tất cả lệnh.
- Thêm trường `output_name` trong JSON để đặt tên file xuất thay vì `out_<scriptIdx>.mp4` mặc định.
- Thêm kiểm tra tồn tại file audio trước khi tạo lệnh FFmpeg.

---

Nếu bạn muốn, mình có thể: (1) viết script helper để tự động chạy tất cả lệnh FFmpeg, hoặc (2) sửa `index.js` để thay `INPUT_VIDEO` bằng tham số đầu vào và tự chạy lệnh — bạn chọn phương án nào.
