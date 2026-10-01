# MCP Builder — evidence và handoff thiết kế Nextgame v2

**Ngày:** 2026-10-01. **Vai trò:** thành viên MCP Builder của Gu. **Scope:** thiết kế tài liệu; không implementation, không deployment. **Owned files:** `docs/v2/05_MCP_PLATFORM.md`, `deliverables/gstack/raw/mcp.md`.

## 1. Input đã đọc

Đã đọc toàn bộ sáu tài liệu gốc trong checkout:

| Tài liệu | Số dòng | Ảnh hưởng tới thiết kế |
|---|---:|---|
| `PLAN.md` | 220 | Phân biệt kiến trúc demo Worker/D1 lịch sử với release Node/SQLite; same-origin proxy giải quyết third-party cookie; MCP2026/v2 đã là hướng |
| `spec_demo.md` | 1.434 | Con người nghĩ + AI thiết kế + server trọng tài; MCP tools bắt buộc, Apps optional; autonomous/replay/determinism |
| `gameplay.md` | 566 | Vòng lặp thiết kế → tập → đấu → phân tích; version lineage và read replay; không external LLM trong tick |
| `can_bang.md` | 787 | Không coi lý thuyết/cân bằng/bảng số cũ là kết quả thực nghiệm mới; cần matched experiments/mirrored seeds/binding rõ |
| `ky_thuat_my_thuat.md` | 664 | Viewer dùng lại cho web/App; art không feedback vào sim; public replay không đồng nghĩa private Brain trace |
| `BRAIN.md` | 91 | Brain JSON/budget/sandbox, không source code tùy ý; infra failure khác Brain penalty; reference inputs phải pin |

Đã đọc full assigned role, Codex runtime và supporting MCP Builder skill/reference: protocol2026-07-28, best practices, Node SDKv2, OpenAI Extensions, ChatGPT/Codex packaging. Skill cloud setup được đọc theo instruction của môi trường; task này chỉ tài liệu, không cần install/start services hay save environment scripts. Không có `AGENTS.md` tìm thấy qua `rg --files /workspace -g AGENTS.md` tại lúc kiểm tra.

Baseline Gu cung cấp: BotDefinition2.0, 12×12/core2×2, ≤24 modules/budget100, Brain FSM/skills/macros lowered IR, think10Hz/sim60Hz, reviewed mechanic registry; hash canonical gameplay payload và cosmetics riêng; ValidationReport bind hash/engine/ruleset/suite; Ranked2 mirrored legs một rating update. MCP tài liệu không định nghĩa lại damage/gameplay hay schema Brain để tránh conflict với doc03.

## 2. Quyết định đã đưa vào doc05

- Node/TS MCP adapter + Application shared web/MCP, PostgreSQL authoritative, replay object store, isolated sim workers; long jobs không trong handler.
- Hypothesis → revision-checked edit → snapshot validate → matched experiment → compare → freeze → human intent → Ranked → replay.
- 16 workflow tools có input/output, scope, error, job receipts; public rules/schema/catalog; protected resources và typed error union.
- Optimistic locking, exact TargetRef, pinned VersionBinding, per-caller key receipts transactionally committed; signed bounded cursors; quota reservations/refunds; worker lease/fencing/outbox.
- Canonical package identity theo doc03; freeze tách admission; validation “completed” khác “passed”; no silent gameplay migration.
- Ranked intent mint từ authenticated web POST, bind caller/client/grant/hash/season/policy, TTL5phút/single-use; prepare request TTL15phút; MCP không tự tạo consent từ bool/câu nói hoặc scope OAuth. Receipt retry không consume intent lần hai.
- Brain private source/IR/trace, public projection/replay blobs độc lập; signed result verification public khác exact re-sim cần private inputs. Body/cosmetic/public visibility không biến hash thành download entitlement.
- Same-origin web cookie + CSRF/Origin; OAuth resource/AS metadata, auth-code S256PKCE, audience/issuer/scopes/revoke per request; Google identity khác MCP consent/Ranked intent.
- Dependency matrix tách SDKv2 backend khỏi OpenAI Extensions0.1.0 helper v1 và browser bridge SDK1.29.0; Apps UI init không xóa vì modern backend không init.
- Reviewed allowlist registry cho Ranked, không arbitrary user plugin/source/network/LLM trong trận; host fallback tools + web link; test plan modern/legacy/actual UI tách.

## 3. Nghiên cứu thực tế: nguồn accessible và unavailable

Python standard library thực hiện read-only HTTP `urllib.request.urlopen` song song tới official sources/npm metadata. Không môi trường code/app nào được chạy. Các kết quả:

| URL | Kết quả quan sát |
|---|---|
| `https://modelcontextprotocol.io/specification/2026-07-28` | Proxy tunnel403 Forbidden; không đọc live spec được |
| `https://modelcontextprotocol.io/specification/2026-07-28/changelog` | Proxy tunnel403 Forbidden |
| `https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28.html` | Proxy tunnel403 Forbidden |
| `https://raw.githubusercontent.com/openai/mcp-extensions/900032d8bd7c1566202d0cb1666986584f932043/typescript/package.json` | Proxy tunnel403 Forbidden |
| `https://registry.npmjs.org/@modelcontextprotocol/server/2.2.0` | HTTP200; version2.2.0; deps `zod:^4.2.0`, `@modelcontextprotocol/core:2.2.0` |
| `https://registry.npmjs.org/@modelcontextprotocol/client/2.2.0` | HTTP200; version2.2.0; core2.2.0; version-negotiation declarations available |
| `https://registry.npmjs.org/@modelcontextprotocol/node/2.1.0` | HTTP200; peers server^2.1.0, hono^4.11.4 |
| `https://registry.npmjs.org/@openai/mcp-extensions/0.1.0` | HTTP200; peers SDK^1.29.0, ext-apps^1.7.5; package deps zod4.4.3 |
| `https://registry.npmjs.org/@modelcontextprotocol/ext-apps/1.7.5` | HTTP200; peer SDK^1.29.0; Zod3.25+/4 peer |

Sau đó đọc in-memory tarballs từ `dist.tarball` của server/client/node/OpenAI Extensions; **SHA-512 của cả bốn tarball khớp `dist.integrity`**, không disable TLS/checksum, không execute extracted files hay install dependencies. Package types chủ yếu `.d.mts/.d.cts`, không chỉ `.d.ts`. Quan sát declaration:

| Package | Evidence đọc được |
|---|---|
| server2.2.0 | `dist/createMcpHandler-CfX6zgs1.d.mts`: `createMcpHandler`, `serveStdio`, 2026-07-28, adapter `toNodeHandler` references |
| client2.2.0 | `dist/index.d.mts`: `versionNegotiation?: VersionNegotiationOptions`; `index-D_QDtbiv.d.mts` references2026-07-28 |
| node2.1.0 | `dist/index.d.mts`: public `toNodeHandler` declaration/docs |
| OpenAI Extensions0.1.0 | `dist/app/extensions.d.ts`, `dist/server/extensions.d.ts`: `OpenAIExtensions` exists; version/peers từ publisher metadata |

Semantics modern metadata/header/resultType/discovery/MRTR/cache/error codes được đọc từ **bundled pinned protocol reference**, verified bởi skill tác giả2026-09-30; Extensions compatibility guide checked2026-10-01/pinned commit. Npm declarations corroborate API/version tồn tại; chúng không chứng minh host compatibility hay runtime compliance. Doc05 nguồn S1–S9 gắn official URL và provenance.

Command pattern để đội implementation recheck (read-only research, không runtime test):

```python
import urllib.request, json, tarfile, io, hashlib, base64
name, version = "@modelcontextprotocol/server", "2.2.0"
meta = json.load(urllib.request.urlopen(
    f"https://registry.npmjs.org/{name}/{version}", timeout=25))
blob = urllib.request.urlopen(meta["dist"]["tarball"], timeout=25).read()
digest = "sha512-" + base64.b64encode(hashlib.sha512(blob).digest()).decode()
assert digest == meta["dist"]["integrity"]
archive = tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz")
for member in archive.getmembers():
    if member.isfile() and member.name.endswith((".d.mts", ".d.cts", ".d.ts")):
        declarations = archive.extractfile(member).read().decode()
        # Inspect declaration/API signatures; do not execute the package.
```

## 4. Verification thực hiện trong task này

Đã kiểm documents/references, official npm metadata, publisher tarball integrity và declarations, đọc lại own artifacts/review contract coherence. `git diff --check` exit0; Python markdown structure check kiểm fenced blocks cân bằng, nhận diện16tools, own raw link tồn tại; các peer links04/07 chưa được viết tại thời điểm kiểm. Sau khi doc03 xuất hiện, đã đọc toàn bộ và đồng bộ request256KiB/nesting32, tên64Unicode scalar, catalogDigest/schemaVersion/brainAbiVersion/compilerDigest, canonical hash/presentationHash. Source docs có một số historical values khác nhau (cooldown6/18, white/dark, WorkerD1/NodeSQLite), do đó doc05 dùng baselinev2/refs thay kế thừa số cũ vào contracts.

**Không chạy:** server HTTP/stdin, tool calls, OAuth, Google login, actual ChatGPT/Codex/Claude clients, MCP Apps render, Brain/sim, freeze/Ranked/rating, build/typecheck, dependency install, lockfile generation. Không có observed Nextgame wire protocol hay actual host version để báo pass. Compatibility “verified” trong output chỉ là dependency metadata/declaration/reference evidence. Doc05 mục13 là acceptance plan chưa thực hiện; score QA/runtime N/A.

## 5. Review cần Gu điều phối

Security reviewer kiểm intent web ceremony, approval handle ACL/client/grant binding, concurrent submission/idempotency, private Brain projections, OAuth metadata fetching/SSRF và admin/worker separation. Architecture owner kiểm worker quota/outbox/fencing/quota settlement cùng doc04. Doc03 owner kiểm canonical fields/TargetRef/patch schema/ref names; doc07 kiểm exact bracket/account entry policy/rating series. UX owner dùng cùng scope/privacy/approval model; UI fallback và replay projections không hứa source-less exact external re-sim.

Implementation phải chọn/pin exact Zod/runtime lockfile và kiểm published signatures; adapter modern boundary tests độc lập app frontend tests, legacy path và named host UI/Auth tests. OpenAI TS helper0.1.0 **không v2 backend-compatible** theo peer contract; không giải bằng cast/override. Apps feature có thể deferred nếu tools/auth/intent đạt và web fallback hoạt động.

Không sửa sáu tài liệu nguồn hay file khác; không spawn/contact peer; chỉ báo cáo Gu.
