Step 1(P): Video gốc -> Srt ()
Step 1.1: Flow upload video lên youtube (Module upload-video)
 + Input: video trong folder uploads
 + Output: outputs/upload-video/{video_id}/
Step 2.2: Script down subtitle từ video đã upload
 + Input: outputs/upload-video/{video_id}/
 + Output: outputs/downloaded-subtitles/{video_id}/

Step 2(P): 
Step 2.1 Tạo kịch bản tóm tắt + review
Input: outputs/downloaded-subtitles/{video_id}/ => Chỉ cần truyền ID vào
Output: outputs/generated-scripts/{video_id}/script.txt

Step 3 (Long): Build vector database để search giữa kịch bản tóm tắt với SRT -> Timeline
Input:  outputs/generated-scripts/{video_id}/script.txt + outputs/downloaded-subtitles/{video_id}/
Output: 


Step 4(T): Chuyển kịch bản tóm tắt ban đầu thành audio
Input: Từng câu text
Output: Audio cho từng câu


Step 5(T): Xuất 1 file meta data để cho biết duration từng câu đọc
Input: Kịch bản review raw (ko có timeline)
Output: Mỗi câu sẽ có 1 duration với câu đó
Ví dụ:
Video xoay quanh việc Nobita muốn trở nên ngầu và điềm đạm như tay súng trong phim sau khi bị mẹ nhắc nhở làm bài tập về nhà. -> 7s

Step 6(Long): Chọn cảnh phù hợp cho từng câu tóm tắt dựa vào video gốc + Step 3
Cắt cảnh dựa vào step 5 + step 3
Ví dụ: câu đọc 6s (step5) + step 3 duration vượt quá 6s -> Cắt cho đủ 6s
Output:

Câu 1 - duration - timeline
Câu 2 - duration - timeline
Câu 3
