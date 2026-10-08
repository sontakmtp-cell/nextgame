# PROMPT Chiến — ghi chú dài hạn

## Ngôn ngữ & người dùng
- Người dùng (Khầy) giao tiếp bằng **tiếng Việt**; tài liệu dự án và UI cũng bằng tiếng Việt. Trả lời bằng tiếng Việt.

## Dự án
- Web game 2D: người + AI đồng thiết kế bot ("Synth") qua MCP; bot tự chiến đấu, tiến hóa, xếp hạng.
- Stack: React + Vite (UI), **PixiJS 8** (sân), engine tất định chạy trong **web worker**. Monorepo pnpm.
- Packages: `brain, content, contracts, engine, renderer, replay`. Apps: `web, cli, api`.
- **Nguồn luật:** Docs/02 · **Bot/Brain:** Docs/03 · **tool/MCP:** Docs/05 · **ranked:** Docs/07 · **UI/art:** Docs/06 (chuẩn art/UX, 21 token bảng màu). Xung đột → dừng ticket, sửa nguồn.

## Trạng thái
- Đã triển khai tới **G2 local** (T07/T08). G2 **chưa nghiệm thu**: gate người thật + art QA độc lập + frame p95 desktop còn thiếu/fail.
- `packages/design-system` được yêu cầu trong Docs/04 + Docs/08 (T07) và whitelist ở `scripts/boundaries.mjs` nhưng **chưa được tạo** — cần tạo khi làm UI.

## Quy ước làm việc
- Không đổi luật/ABI/score/quotas để test pass; đề xuất ADR nếu cần.
- Không commit/push/deploy nếu chưa được ủy quyền.
- Đọc `style.css` bằng python (file bị minify trên ít dòng dài).
