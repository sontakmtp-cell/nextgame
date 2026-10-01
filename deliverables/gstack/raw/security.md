# Security design review — PROMPT Chiến v2

## Metadata và giới hạn bằng chứng

- Reviewer: gstack-security-officer; team gstack-nextgame.
- Ngày: 2026-10-01.
- Loại công việc: **document design review**, không security scan implementation hay production probing.
- Đã đọc: README; docs/v2/01_PRODUCT.md, 02_GAMEPLAY.md, 03_BOT_BRAIN.md, 05_MCP_PLATFORM.md.
- Pass đầu chưa có 04/07/08/09; **pass delta đã đọc toàn bộ 04_ARCHITECTURE.md, 07_RANKED_LIVEOPS.md, 08_IMPLEMENTATION.md, 09_QUALITY_SECURITY.md và bản cuối 03/05**. Phần “Final closure” cuối báo cáo là trạng thái mới nhất; SD-01..09 và final delta giữ như checkpoint lịch sử design obligations.
- Không có source implementation, lockfile, deployed endpoint, packet capture hay exploit reproduction. **Không có verified vulnerability**. Tất cả mục bên dưới là threat/assurance obligation của thiết kế; severity là tác động tiềm tàng nếu control không được thực thi. Confidence chỉ đánh giá bằng chứng tài liệu và khả năng threat, không xác nhận exploit.
- Phương pháp: role gstack-security-officer + Codex runtime adaptation; STRIDE và OWASP A01–A10 theo edition trong role nguồn. Không tuyên bố đã kiểm current CVEs. Scope tài liệu ghi đè workflow scan/probing trong role.

## Kết luận pass đầu

Baseline có ranh giới phù hợp: server authority, typed FSM thay arbitrary JavaScript, package/version bất biến, owner-only trace, replay projection, OAuth+ACL, intent người chơi và job ledger. Các controls đã viết này là **yêu cầu cần kiểm chứng**, chưa là bằng chứng hệ thống an toàn.

Trước mở closed Ranked alpha, cần hoàn thiện hợp đồng artifact/signing, compiler work budget, sandbox enforcement, SSRF metadata fetch và transaction crash matrix. Chặn release nếu một test làm lộ Brain, cho phép vượt intent/ownership, nhận artifact sai binding, hoặc áp rating nhiều lần.

## Architecture và trust boundaries

| Ranh giới | Dữ liệu không tin cậy / quyền | Control thiết kế hiện có | Nghĩa vụ chứng minh |
|---|---|---|---|
| Browser/MCP host → Application | JSON, Brain, tên/notes, IDs, scope, retries | Closed schema, owner ACL, CAS, quota, OAuth, CSRF | Same controls từ cả hai adapter; reject trước side effect |
| AI suggestion → domain write | Prompt/BehaviorCard/replay notes | Không làm engine authority; không tool executable | Nội dung không cấp scope, approval, URL fetch hay tool execution tự động |
| Source → compiler → interpreter | DSL, skill graph, expressions | No eval/import/I/O; gas, limits, int32 semantics | Parse/compile work cũng bounded; IR không bypass qua alternate import path |
| Registry/release → worker | Engine/compiler/mechanics code | Reviewed allowlist, pinned digests | Trust origin/signature + exact binding; không chỉ checksum do input cung cấp |
| Application → job/worker → publication | Snapshot, manifest, seed, lease, result | Outbox, fence, no secrets/no outbound | Stale worker không được ghi; worker không truy cập DB/signing/rating |
| Private raw artifact → public replay | Full packages, trace, checkpoints | Projection validator, riêng object ACL | Explicit allowlist projection; không vô tình xuất private field qua blob/cache/error |
| Series → rating/leaderboard | Hai legs, authoritative result | Một rating transaction/series | Exactly-once effects trên at-least-once delivery và retry |
| Web approval → agent submit | Review ID, capability, grant/client binding | POST CSRF, 256-bit opaque, TTL, maxUses1 | Chỉ một consumer; recheck revoke/account/season tại commit |

Attack surfaces dự kiến, chưa deployed: public rules/leaderboard/replay; authenticated web API; OAuth metadata/callback; protected /mcp; private package/job/trace/export; worker queue/object storage; admin release/season/pause/dispute; future Laboratory extensions. Worker/admin không có MCP tool công khai.

## Findings và corrective requirements

### [SD-01] Budget interpreter chưa thay thế budget parse/compile

- **Category:** STRIDE DoS; OWASP A04/A05.
- **Severity:** High nếu API/compile dùng shared process không bounded. **Confidence:** 7/10, theoretical/unverified.
- **Location/evidence:** 03:41 giới hạn uncompressed bytes/nesting; 03:72 fail expansion vượt budget; 03:108 final IR≤2048/gas4096; 03:144 có expansion fixture. Chưa nêu cách chặn allocation/work trước khi sinh toàn bộ expansion. 05:166 tách worker, nhưng compile admission có thể vẫn ở Application.
- **Threat:** DAG skills hoặc source rộng nhỏ về byte nhưng đắt khi inline/normalize; reject chỉ sau expansion tiêu tốn CPU/memory. Nhiều input invalid lặp có thể phá quota compute hoặc block HTTP handler trước reservation.
- **Correction:** Bounded streaming decode và raw AST node/array limits; duplicate-key rejection ngay decoder; count expansion trước allocation với overflow-safe arithmetic; incremental node/work/fuel check trước mỗi substitution; isolated compile task/deadline/memory cap; cache/reject invalid payload hợp lý, không charge ngược thành gameplay loss. Một limit final IR không đủ.
- **Gate:** Vectors boundary/deep/wide/DAG/poison keys/compressed oversized; mọi invalid case terminate trong CPU/memory cap đã đo, không enqueue sim/commit partial draft; global ingress/concurrency cap chống parallel rejection abuse.
- **Priority:** P1, trước compiler admission public.

### [SD-02] Hash xác nhận bytes; cần hợp đồng nguồn tin cậy và signing riêng

- **Category:** STRIDE Tampering/Spoofing; OWASP A08.
- **Severity:** High. **Confidence:** 7/10, theoretical/unverified.
- **Location/evidence:** 03:43–45 canonical gameplay/hash/cache tuple; 03:138 loader allowlist release manifest; 05:184 signed result/manifest; 05:241 signed registry artifact. Canonical digest/signed artifact đã yêu cầu nhưng envelope, trusted signer và verify tại mỗi hop chưa xác định trong files pass đầu.
- **Threat:** Digest tự khai báo của artifact khác không chứng minh artifact từ release được phép. Swap engine/registry/compiler, raw/public blob, schema hoặc result sau upload có thể làm validation hoặc dispute chạy semantics khác và công bố winner sai.
- **Correction:** Versioned immutable MatchManifest bind packageA/B, engine/ruleset/compiler/registry/ABI/suite hoặc queuePolicy, seed/side/order, job/series/leg IDs, exact artifact digests. Consumer recompute digest trên bytes và kiểm allowlist server-side; mismatch fail closed. Signed public envelope có signed fields canonical, algorithm/keyId, trusted published keys, key rotation/revocation và verifier version. Signing authority ngoài simulation worker; worker không tự ký kết quả tùy ý. Define catalogDigest↔registryDigest một lần ở 03/04/05 để không bỏ field vì tên khác.
- **Gate:** Mutate mỗi digest/header/manifest byte, swap two legs/packages, malicious unsigned registry, unknown/revoked signer, object bytes khác metadata hash, stale compiler cache → reject/no rating. Replay công khai chỉ chứng minh signed manifest/event consistency; không gọi đó là full private resimulation.
- **Priority:** P1, trước artifact publication/Ranked.

### [SD-03] Retry và exactly-once rating cần crash-point contract

- **Category:** STRIDE Tampering/Repudiation/DoS; OWASP A04/A08/A09.
- **Severity:** High. **Confidence:** 7/10, theoretical/unverified.
- **Location/evidence:** 05:78 idempotency receipt+effect transaction; 05:143 hai legs/một rating transaction; 05:153–157 consume intent atomic; 05:163–166 outbox/fence/publication. Core mitigation đã có; chi tiết series/rating nằm trong 07 chưa hiện diện.
- **Threat:** Process crash sau upload trước DB commit, sau rating trước leaderboard publish, stale worker renew/finish hoặc duplicate queue delivery có thể nhận artifact sai leg, double rate, thiếu event, mất quota hoặc retry manifest khác.
- **Correction:** Unique final result theo leg, unique settlement theo series, immutable rating ledger transaction ID, outbox event unique, publication fenced trong DB transaction. Khi compute at-least-once, side effects exactly-once; chỉ hai valid legs đúng manifest mới settle. Storage upload → checksum validation → authorized DB reference; orphan cleanup không xóa committed refs. Infra failure không làm bot loss. Bounded attempts/DLQ; repeated failing manifest quarantine/pause để không chiếm worker vô hạn, không tùy tiện gán gameplay loss.
- **Gate:** Fault injection ở reserve/outbox/claim/upload/reference/leg finalize/series finalize/rating ledger/outbox delivery và cancel-versus-complete; concurrency hai workers/hai submit keys; assert một receipt/entry/series settlement/rating effect, cùng seed/snapshot, quota conservation; database có constraints chứng minh invariant sau restart.
- **Priority:** P1, trước Ranked.

### [SD-04] Projection privacy là data boundary, bao gồm checkpoint/cache/debug

- **Category:** STRIDE Information Disclosure; OWASP A01/A02/A09.
- **Severity:** High. **Confidence:** 8/10 cho yêu cầu thiết kế, không exploit confidence.
- **Location/evidence:** 03:102 enemy energy/heat không public; 03:122–124 trace riêng; 05:182–188 public/private ACL, blob riêng và public resimulation tradeoff; 05:206 cache scope. Controls đúng; implementation phải giữ xuyên mọi đường xuất dữ liệu.
- **Threat:** Serialize full engine checkpoint rồi chỉ ẩn UI; signed URL/cache cross-user; sourceMap/varDiff/diagnostic hoặc owner opponent trace đi vào public events. Hash một raw private blob rồi publish cùng metadata không biến raw blob thành public-safe.
- **Correction:** Tạo PublicReplay schema allowlist độc lập; public checkpoint chứa chỉ state cần playback public, không interpreter state/private resources. Private raw artifact/owner traces riêng namespace/key/ACL; mỗi owner's trace chỉ phần của họ; default deny exports/HEAD/list/CDN. Redact error/debug/telemetry; short-lived authorized URL; no-store/private cache và ACL invalidation; retention/deletion rõ cho raw full package/trace/backup.
- **Gate:** Seed canary secret trong source/IR/state/variables/opponent energy/heat; scan mọi public API/tool/blob/error/cache/log/checkpoint sau publish; ownerA không đọc trace ownerB cùng match; cross-tenant ID/hash/URL tests, expired/revoked sharing, CDN cache reuse tests.
- **Priority:** P1, trước public replay/cloud storage.

### [SD-05] Intent/web fallback phải giữ grant/client binding và không thành confused deputy

- **Category:** STRIDE Spoofing/Elevation of Privilege/Repudiation; OWASP A01/A07/A04.
- **Severity:** High. **Confidence:** 8/10 cho threat design, theoretical/unverified.
- **Location/evidence:** 05:190–198 OAuth/session boundary; 05:146–157 intent ceremony/consume; 05:208 protected MRTR state; 05:237 Apps UI không trusted ceremony. Đây là controls tốt cần preserve khi triển khai fallback.
- **Threat:** MCP request tự nhận “web mode”, clientInfo thay identity, signed continuation tái sử dụng bởi grant khác; GET approve/prefetch side effect; revoked grant retry lấy cached handle; web owner approve nhầm package/season giữa edit/submit.
- **Correction:** Web authenticated route và MCP OAuth route phân biệt bằng verified transport identity, không body flag; capability bind owner, trusted clientId, grantId, exact package/policy/season; review display server-resolved và commit recheck. Receipt lookup cũng reauthorize. MRTR state protected/short-lived/replay bounded, không secrets; không MRTR continuation làm ranked approval. Step-up/read Brain OAuth nói rõ provider có thể nhận nội dung; không tự opt-in publish/train.
- **Gate:** Fake confirmed/auto-approve/GET/cross-grant/client/subject, token revoke/account lock ngay trước commit, two consume concurrent, wrong season/hash/policy, replay expired state, MCP claims web mode → reject; đúng retry key trả receipt sau reauthorization.
- **Priority:** P1, trước OAuth/MCP Ranked.

### [SD-06] Dynamic OAuth metadata/CIMD là đường SSRF riêng

- **Category:** STRIDE Information Disclosure/DoS/Elevation; OWASP A10.
- **Severity:** High nếu dynamic fetch bật. **Confidence:** 6/10, theoretical/unverified.
- **Location/evidence:** 05:194 có “metadata kiểm duyệt; ... không tự fetch untrusted client metadata qua mạng nội bộ”; 05:60 chỉ resolve ID, không arbitrary URL. Chưa có retrieval policy cụ thể cho auth metadata.
- **Threat:** URL HTTPS public redirect/rebind DNS đến loopback/private/metadata endpoint, huge response, parser ambiguity hoặc remote mutable client metadata thay redirect URI sau review.
- **Correction:** Prefer preconfigured trusted AS/client metadata hoặc feature-gate dynamic retrieval. Nếu bật: HTTPS-only exact origin/port allowlist, không userinfo, bounded bytes/time, không credentials/cookies, reject redirects hoặc revalidate từng hop; resolve và validate toàn bộ IPv4/IPv6 against loopback/link-local/private/metadata, chống DNS rebinding với connect-to-validated address/TLS host verification. Cache reviewed version; metadata update không silent mở redirect URI. Auth retrieval service có egress policy độc lập.
- **Gate:** localhost/IPv6/mapped IPv4/metadata/private DNS, redirect chain, rebind, oversized/chunked/slow response, mutable redirect metadata; record reject trước network đến forbidden destination. Disabled feature cũng là mitigation chấp nhận được.
- **Priority:** P1 nếu feature enabled; feature có thể chưa bật alpha.

### [SD-07] “Pure TypeScript” và review không là sandbox security boundary

- **Category:** STRIDE Elevation/Tampering/DoS; OWASP A06/A08/A05.
- **Severity:** High. **Confidence:** 7/10, theoretical/unverified.
- **Location/evidence:** 03:138 reviewed TS hooks/no DB/network/time; 03:140 WASM ADR riêng; 05:166 isolated/no-secret/network-off worker; 05:241–243 registry promotion. Runtime permission enforcement chưa có 04.
- **Threat:** Compromised extension build/dependency/import hoặc unsafe host callback bypass “pure” convention; interpreter bug thoát sang worker credentials; archived engine vulnerabilities chạy trong trusted process khi xem replay cũ.
- **Correction:** Distinguish platform-authored trusted code from untrusted DSL. Reviewed hooks bundled/pinned through reproducible release and dependency integrity; no arbitrary import/hot-load/native dynamic addon. Worker OS/container user low privilege, enforced deny egress, read-only minimal filesystem, ephemeral scratch, no app/DB/OAuth/signing credential or metadata service. Orchestrator nhập payload/collect output thay cấp broad object-store token worker. Lab/user-WASM separate identity/network/quota/pool, no rating; archived engine only isolated verifier, never API process.
- **Gate:** Harmless local attempts to open network/file/process/metadata and privilege escapes rejected; compare deployed IAM/network/container policy to contract; signed registry allowlist gate at loader; secret canary không trong process env/mounts; lab saturation không block Ranked pool. No external/prod probing.
- **Priority:** P1 trước hosted simulation; extension promotion bắt buộc review riêng.

### [SD-08] Quota per subject cần thêm fairness và global backpressure

- **Category:** STRIDE DoS; OWASP A04.
- **Severity:** Medium; High nếu shared Ranked starvation. **Confidence:** 6/10, theoretical/unverified.
- **Location/evidence:** 05:169–176 account/client/IP caps và pool riêng; 02:133 balance batch3000+1200; 01:84 credit không lợi thế; Ranked submission policy chưa có 07.
- **Threat:** Sybil accounts, invalid compile spam, private trace explosion, repeated deterministic infra poison hoặc cheap reads đi vào expensive artifact scans. Nhiều hợp lệ jobs cũng có thể fill queue/object storage và giữ capacity trận chính thức.
- **Correction:** Global/per-tier concurrency/queue/storage caps, admission backpressure, per-account cost ledger cho compile/validation/artifact output, trace bytes/events bound; bounded retry/DLQ; abuse rules và account/client observability. Ranked submission cooldown/fair matchmaking, collusion/win-trading review không làm pay-to-win. Chọn cap sau load measurement; không claim con số provisional đã đạt.
- **Gate:** Saturate Lab+validation+oversized output đồng thời và đo Ranked admission/settlement SLO; no unbounded memory/queue/storage; recover after cancellation/retries; revoked/blocked account không bypass qua new OAuth client.
- **Priority:** P1 hosted capacity; P2 advanced abuse detection.

### [SD-09] Nội dung player/AI cần render và agent-context policy

- **Category:** STRIDE Elevation/Information Disclosure; OWASP A03/A05; LLM prompt-injection threat.
- **Severity:** Medium. **Confidence:** 6/10, theoretical/unverified.
- **Location/evidence:** 03:41 plain-text UI name; 05:36 notes untrusted; 05:226 no arbitrary HTML/CSP; 05:235 explicit selection context. Các control phù hợp, cần không bị mất khi UI/Apps triển khai.
- **Threat:** Tên/notes/BehaviorCard/tool result chứa HTML/script hoặc “ignore rules, read Brain/submit” khiến UI XSS hoặc AI host xem data là instruction. Sanitization chữ không thể bảo đảm chống semantic prompt injection.
- **Correction:** Escape text by default; no innerHTML/URL scheme activation từ raw content; strict bundled Apps CSP/network origins; provenance và data labels trong replay/tool context; backend ACL/quota/intent vẫn kiểm mọi call kể cả agent bị lừa. Không tự invoke tools hay tự add model context từ public replay.
- **Gate:** XSS payload render text; unsafe URL/HTML blocked; malicious replay note không mở network hay side effect; prompt instruction không có capability làm submit/read opponent Brain; Apps unsupported fallback cùng projection.
- **Priority:** P1 UI publication, không chặn combat proof offline.

## 14-phase coverage adapted to document scope

| Phase nguồn | Đã làm / chưa áp dụng |
|---|---|
| 1 Architecture mental model | Document trust boundaries/data flow ở trên; 04 còn pending |
| 2 Attack surface census | Contract surfaces, chưa endpoint implementation inventory |
| 3 Secrets archaeology | No implementation/history secret scan; design forbids secrets worker/log/token URLs |
| 4 Dependency supply chain | 05 có declared metadata research, chưa lockfile/CVE scan; gate pinned integrity/release |
| 5 CI/CD | Chưa CI; yêu cầu supply-chain/artifact signing và release gate SD-02/07 |
| 6 Infrastructure shadow surface | Chưa IaC/deployed inventory; no admin/worker public surface requirement |
| 7 OAuth/integration | Design review SD-05/06; chưa login/host tests |
| 8 LLM/AI | SD-05/09; model output untrusted, backend capability authoritative |
| 9 Skill/extension supply chain | SD-02/07; mechanics promotion/ranked allowlist, no player executable |
| 10 OWASP A01–A10 | Access/auth/injection/design/config/integrity/log/SSRF covered; current CVE/crypto library config unavailable |
| 11 STRIDE | Table và SD findings cover all six categories |
| 12 Data classification | Matrix bên dưới; retention/account deletion detail cần 09 |
| 13 Active verification/filter | Chỉ đối chiếu tài liệu; mọi exploit unverified; do not run production PoCs |
| 14 Report/trend | File riêng được giao; no historical verified scan baseline, no grade/trend invented |

## Data classification

| Class | Dữ liệu | Control/retention yêu cầu |
|---|---|---|
| Public | Rules/catalog, visible Body, creator display, public hash/result/rating, projected replay | Signed/integrity, versioned; no Brain/private checkpoint; moderation/accessibility |
| Internal | Queue seed before match, matchmaker/debug, worker manifest, abuse events, internal resim | Service IAM, no public APIs/cache, least privilege, retention finite |
| Confidential | Brain source/IR/parameters, owner trace, private experiments/suites, account linkage | Owner/collaborator ACL+brains:read; encrypted storage; trace30 days alpha; exports/deletion policy |
| Restricted | OAuth/refresh/session tokens, approval handles, signing keys, service credentials | No worker/model context/log/URL; short-lived/revoke; secret manager; approval5 min single use |

Public unsalted package SHA256 is a commitment and can reveal equality or allow offline guesses of low-entropy/template Brains. 05:186 already rejects absolute secrecy and acknowledges behavior inference; document equality/guessing as accepted residual privacy risk rather than treating hash as encryption. No recommendation to salt gameplay identity unless package/replay semantics are redesigned explicitly.

## Concrete release gates for Gu to place in 09/08

1. **SG-CONTRACT:** closed schema/duplicate JSON key/raw AST budget/canonical hash vectors; compile rejects before resource cap; IR fuel4096/4097 atomic and fault semantics pass. Owner T02/T03.
2. **SG-ISOLATION:** effective worker IAM/network/mount/user/CPU/memory controls tested; no service secrets or DB/signing rights; Lab/Ranked separation. Owner architecture/worker ticket.
3. **SG-INTEGRITY:** all manifest digest bindings, corrupted/swap artifact/unknown signer, compiler cache mismatch fail closed; projection validated before publication. Owner replay/worker/platform tickets.
4. **SG-PRIVACY:** canary Brain/trace/opponent resources absent from public API/blob/cache/log/UI/errors; cross-account/URL expiry/revoke tests. Owner API/replay tickets.
5. **SG-AUTH-INTENT:** OAuth PKCE/issuer/audience/redirect/revoke/scopes; per-object ACL; CSRF/Origin; same/grant/client/season/hash single-use capability and web fallback abuse tests. Owner auth/MCP ticket.
6. **SG-SETTLEMENT:** crash/retry/stale fence/cancel matrix; two exact legs; one ledger effect; outbox eventually publishes matching leaderboard; quota conservation. Owner Ranked/worker ticket.
7. **SG-EGRESS:** dynamic metadata disabled or SSRF tests+egress restrictions pass; no arbitrary tool/resource fetch. Owner auth ticket.
8. **SG-ABUSE-RECOVERY:** measured load caps, Lab saturation vs Ranked SLO, bounded retries/quarantine/pause, backup/restore and audit export without secrets. Owner ops/Ranked ticket.
9. **SG-EXTENSION:** each new registry hook has signed allowlist, deterministic resource budget/event+privacy schema, fuzz/fixture/perf/security/balance review, archived verifier isolation; no automatic promotion from player upload.

Gate evidence phải ghi revision, platform/config, command/test artifact, expected invariant, actual result và exceptions có owner+expiry. Chưa implementation: tất cả gates ở trạng thái **planned/not run**. No defensible security score; N/A. Một verified High/Critical exploit hoặc test vi phạm ownership/privacy/intent/artifact/rating invariant là release blocker; threat đã có control thiết kế không tự đồng nghĩa verified defect.

## Handoff cho Gu

Thay đổi cần đưa vào docs: 03 thêm raw/expansion work limits và canonical binding naming; 04 thêm effective sandbox IAM/egress/signing/object publication; 07 thêm ledger/crash/retry/dispute/abuse invariants; 08 map gates to actual tickets/dependencies; 09 data classification/retention, security matrix, evidence và stop conditions. 05 đã có nhiều control đúng; preserve co-create rộng trong quota và human approval chỉ tại runtime Ranked intent. Review này không yêu cầu người dùng duyệt lại việc tái cấu trúc tài liệu đã được trao quyền.

## Final delta review — trạng thái mới nhất

### Các correction đã hiện diện trong bản baseline cuối

| Obligation pass đầu | Bằng chứng cập nhật | Trạng thái |
|---|---|---|
| SD-01 compiler work trước allocation | 03:110 source4096/call edges64/depth16; incremental abort node2049/work50000/deadline2s sandbox; 08:70–71 fixtures | Addressed in design; tests unrun |
| SD-02 artifact provenance/signing/binding | 04:109 separate release/result trust anchors và rotation/revocation; 04:117–123 manifest/hash/Ed25519 envelope; 05:60,140 exact catalogDigest/schema/ABI/compiler fields | Addressed in design; tests unrun |
| SD-03 leases/publication/two legs/rating retry | 04:105–113 bounded3attempts/fence/finalizer/unique effects; 07:38 sorted user locks; 09:107 crash matrix | Normal settlement addressed; correction-version race còn FD-02 |
| SD-04 privacy/projection | 04:119–123 public pose chunks khác private full checkpoints; 09:96 canary allowlist, signed URL window/proxy; 09:124–126 retention | Addressed in design; thuật ngữ05 cần clarify FD-03 |
| SD-05 auth/intent | 05:150–154 caller/client/grant/package/season/policy binding, POST only, atomic consume; 09:106 negative gate | Core addressed; repeated approve/revoke CAS còn FD-01 |
| SD-06 metadata SSRF | 09:94 exact origin allowlist, IPv4/IPv6 forbid, DNS pin, HTTPS, no redirects,64KiB/2s, disable if unsafe | Addressed in design; tests unrun |
| SD-07 OS sandbox/registry | 04:107 no network/secrets/object credentials/signing key, supervisor upload; 03:140–142 allowlist/promotion/isolated future WASM; 09:103,110 | Addressed in design; tests unrun |
| SD-08 resource/abuse | 04:125 bytes/events caps; 07:17,21 account submission/repeat-pair policy; 09:70 stress and109 recovery | Addressed in design; measured limits unrun |
| SD-09 content/agent/Apps | 05:36 untrusted notes,226 CSP/no arbitrary HTML,235 explicit context,237 trusted ceremony; 03:41 plain text | Addressed in design; rendering/host QA unrun |

### [FD-01] P1 — Một review phải có một consent, không chỉ mỗi handle single-use

- **Category/severity:** STRIDE Elevation/Repudiation, OWASP2021 A01/A04; High potential impact; priority P1 design correction. **Confidence:** 7/10 document gap; theoretical/unverified.
- **Evidence/location:** 05:52 review có status; 05:152 POST tạo capability `maxUses:1`,05:154 consume atomic. Không nêu unique intent per review, idempotent approve POST, expected review revision/state hoặc terminal no-reapprove. 04:97 table chỉ token_digest/user/package/season/policy/expires/consumed. 07:17 một submit cho phép đúng một series.
- **Threat:** Repeated/parallel approval POST có thể mint hai handles cùng review; một-entry constraint chỉ chặn đồng thời. Nếu series đầu settled trước5min, handle thứ hai có thể tạo series thứ hai từ cùng lần người chơi duyệt. Revoke-versus-approve/consume chưa có CAS có thể phục hồi consent đã hủy.
- **Correction:** `ranked_reviews`/intent row bind reviewId/subject/client/grant/package/season/policy + revision/status. Unique review→one intent. Approve transaction CAS `awaiting_human→approved`; retry same POST return same handle with original expiry, no extra capability/no extend TTL. Consume CAS `approved→consumed` trong queue/receipt transaction. Revoke CAS cùng row/lock; revoked/expired/consumed terminal, phải prepare review mới. Recheck account/grant/review expiry at commit.
- **Gate:** Concurrent duplicate approve; approve retry after network loss; approve-versus-revoke; revoke-versus-submit; approve after consumed/expired; submit two handles same review across two sequential finished series. Assert one capability/one series authorized and no reactivation.
- **Owner:** T09/T11; Q17 + SG-AUTH-INTENT. Gửi Gu để sửa docs, reviewer không edit peers.

### [FD-02] P1 — Ledger correction cần versioned storage và atomic activation

- **Category/severity:** STRIDE Tampering/Repudiation, OWASP2021 A04/A08/A09; High potential impact; priority P1 design correction. **Confidence:** 8/10 document mismatch; theoretical/unverified.
- **Evidence/location:** 07:62 rebuild Elo theo settle order, giữ original ledger/replay, unique correction run và freeze leaderboard. 04:95 rating_events unique series+user,04:96 ratings chỉ season+user/revision. Chưa có correction-run/version trong ledger schema hay active-ledger pointer. Chỉ freeze leaderboard không bảo đảm live ratings/settlement dừng trong recompute.
- **Threat:** Rebuild không thể lưu corrected event cho cùng series/user mà giữ original với unique hiện tại; update tại chỗ phá audit. Settlement mới trong rebuild có thể dùng ratings cũ hoặc bị mất khi snapshot corrected ghi đè; profile/matchmaker/leaderboard đọc các version khác nhau.
- **Correction:** Append-only ledger_runs/correction_runs và events unique `(ledgerRunId,seriesId,userId)`; deterministic total settle sequence/checkpoint và excluded-set digest; active ledger version pointer per season/bracket. Closed alpha chọn pause admission **và settlement**, drain/quarantine rõ và watermark frozen trước rebuild (hoặc design catch-up algorithm explicit). Recompute provisional count/K_pair/counters toàn bộ affected state, không chỉ delta; atomically activate corrected ratings+ledgerVersion+leaderboard snapshot/reference. Retry same correctionRunId không apply lại; keep original results/replay, mark correction provenance; rollback restore active version pointer atomically.
- **Gate:** Invalid early series với subsequent opponents, negative/round/provisional thresholds; concurrent settlement at watermark; crash before/after activation; retry same run; profile/matchmaker/snapshot same version; rollback; excluded invalid series không tính completed/provisional W/D/L. All events/account balances conserved per active run.
- **Owner:** T12/T14; Q18 + SG-SETTLEMENT/SG-ABUSE-RECOVERY. Gửi Gu để sửa docs, không verified exploit.

### [FD-03] P2 — Thuật ngữ “public checkpoints” phải khác private full checkpoint

- **Category/severity:** STRIDE Information Disclosure, OWASP2021 A01; Medium wording risk; P2 clarification.
- **Evidence:** 05:184 public replay có “damage/events/checkpoints” trong khi04:121 full resource/VM/RNG checkpoints private và viewer seek từ pose chunks; 09:96 public codec allowlist.
- **Correction:** 05 gọi `public pose chunks/index/event continuity` hoặc explicitly `public-projection playback checkpoints`, không full engine checkpoints. 04 là source truth: public playback không VM restore. Current combined design already forbids private dump, nên không report confirmed leak.
- **Gate:** Q10/SG-PRIVACY canary in VM/resources/checkpoint bytes absent from all public codecs.

### Consistency checks riêng theo yêu cầu Gu

- **Module identity:** 02:108,116 và03:43,118 dùng geometry ordinal; Brain refs và static module sensor suffix phải remap bằng compiler. 08:71,77 rename/ordering fixture. Không thấy module role/name tạo privilege hay ưu tiên riêng; source module IDs là references, không worker/service role identity.
- **Private/public:** 04:121 full checkpoints internal;04:131 renderer không nhận checkpoint;05:186 không hứa public private re-simulation. Privacy architecture hợp lý sau khi clarify FD-03.
- **Worker roles:** sandbox không signing/storage credentials; supervisor identity upload; finalizer key service ký. Admin RBAC+MFA/audit ở07:64, không MCP bypass. Chưa implementation/IAM test.
- **Rating:** Normal finalizer đúng one effect/two verified legs/fence; Elo correction replay approach đúng hơn inverse-delta, nhưng phải FD-02 version+cutover để thực hiện nguyên tắc đó.
- **Consent:** Draft edit CAS và freeze transaction không thay immutable approved package. Grant/account checks tốt; review status CAS/one-intent uniqueness cần FD-01.

### Kết luận delta

Không có P0 design finding, không verified vulnerability. Bản cuối đã xử lý đa số pass đầu và map controls vào T02/T03/T09/T10/T11/T12/T14 cùng Q/SG gates. **Hai P1 document contract corrections FD-01/FD-02 còn pending tại thời điểm delta này**, FD-03 là clarification. Sau khi Gu đưa corrections vào docs, có thể handoff triển khai T01; không có bằng chứng cho phép công bố Ranked đã an toàn/sẵn sàng. Security score vẫn N/A; tất cả runtime security gates planned/unrun.

## Final closure — 2026-10-01, authoritative review status

Đã đọc lại chính các đoạn Gu sửa trong04/05/07/09 sau delta, bằng `nl -ba` và exact range reads. Không sửa source/docs của peers, không chạy simulation/server/OAuth/probing. Các findings trước đây được đóng **ở mức hợp đồng thiết kế**, không là security fix đã kiểm chứng runtime.

| Finding | Bằng chứng hiện tại đã đọc | Closure |
|---|---|---|
| FD-01 consent CAS/unique review intent | 05:156 state CAS, unique intent/review, duplicate POST same handle+expiry/noTTL extension, terminal no-reapprove, common review+intent lock và revoke/consume outcome;04:98–99 rows bind client/grant/review/state/revision;09:107 explicit negative gate | **Resolved in design**; T09/T11/T14 phải chứng minh concurrency/runtime |
| FD-02 ledger version/correction cutover | 04:95–97 ledger_runs/run-scoped events/ratings/active pointer;04:117 active-run+season-lock pin, pause admission+settlement/drain/watermark/atomic activation/retry/rollback restriction;07:64 total settle_sequence, versioned recompute/activation và post-reopen catchup;09:109 explicit gate | **Resolved in design**; T12/T14 phải chứng minh fault/concurrency/counter reconstruction |
| FD-03 public checkpoint terminology | 05:186 public pose chunks+seek index và full engine checkpoints private;04:123–127 public pose/VM checkpoints/hash distinctions | **Resolved in design**; Q10/SG-PRIVACY runtime canary chưa chạy |

Review pass cuối **không còn P0/P1 design correction mở trong phạm vi đã rà**. Không phát hiện thêm mâu thuẫn trọng yếu tại ba fixes. Bốn bất biến sản phẩm vẫn được giữ: co-create MCP, autonomous combat, ranked/leaderboard authoritative và bot/DSL mở rộng có giới hạn; human intent chỉ giới hạn submission Ranked trong sản phẩm, không cản sửa/simulate đã được trao quyền.

**Kết luận bàn giao:** tài liệu đủ rõ để bắt đầu T01 và triển khai gates theo08/09. Đây là document review hoàn tất, **không phải runtime security certification hay release approval**. Verified vulnerabilities=0 do không có implementation kiểm chứng; không có security score hợp lệ (N/A). Tất cả auth/ACL/sandbox/privacy/signature/SSRF/settlement/consent/ledger correction tests còn **planned/unrun**; Ranked release vẫn No-Go cho đến khi bằng chứng đúng revision đạt các gates.
