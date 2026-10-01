# 09 — Chất lượng, bảo mật và điều kiện phát hành

**Đây là kế hoạch nghiệm thu v2, không báo cáo game đã chạy.** Đầu vào01/10/2026 chỉ có tài liệu; G0 hiện có test runner/contracts/Brain và smoke web/API. Bằng chứng Q01–Q03 phần G0 ở [G0 report](../deliverables/implementation/G0_REPORT.md); các gate gameplay/host/alpha dưới đây vẫn unrun. Không dùng báo cáo tài liệu lịch sử thay runtime evidence.

## 1. Phân tầng kiểm chứng

| Tầng | Chứng minh | Không chứng minh |
|---|---|---|
| Schema/static | Input bounds, typings, boundaries, content references | Game vui, OAuth host hoạt động |
| Engine unit/property | Numeric semantics, phases, collision, gas | Renderer/readability và ops reliability |
| Differential/replay | Same inputs/binding→same outcome, seek parity | Private Brain công khai hoặc signature hợp lệ |
| Functional end-to-end | Full player loop+tools+permissions | Chịu tải hoặc giữ60FPS mọi thiết bị |
| Visual/usability | Đọc trận, chỉnh bot, UX/error states trên người/máy thật | Cân bằng dài hạn/esports |
| Security/fault/load | Trust boundaries/races/capacity/recovery | Không bao giờ bị exploit hoặc downtime |

Mỗi artifact ghi exact git revision, lockfile/content/engine digests, runner version, OS/CPU/GPU/browser, commands+exit codes, seed manifest, counts và current-run timestamps. Không dùng artifact của lần chạy cũ làm pass mới. Piping phải preserve exit status; zero test không pass. Expected failure chỉ accepted khi runner ghi rõ, không disable assertions.

## 2. Test matrix bắt buộc

| ID | Đầu vào / tình huống | Bằng chứng đạt | Owner/Gate |
|---|---|---|---|
| Q01 | Body overlap/grid/core/budget/detached/poison fields | Valid examples pass, invalid cases reject đúng pointer và không allocate quá cap | T02/G0 |
| Q02 | Rename/reorder modules, cosmetics/name edits | Same gameplay normalized/hash/outcome; presentation hash đổi riêng | T02,G1 |
| Q03 | All DSL ops/skill inline/branch short circuit | Golden IR traces, overflow/div0/gas 4096/4097 đúng03, no host I/O | T03/G0 |
| Q04 | High speed, angles, wall corners, many contacts | CCD không tunnel; solver fixed iterations; pure whole-world 180° rotation/slot-label rename là metamorphic fixture, tách actual BO2 slot assignment | T04/G1 |
| Q05 | Weapon phases, simultaneous hits, resource rejects | Exact windup/active/recovery; single attack hit; same-tick Core double kill draw | T05/G1 |
| Q06 | Shield packet batching, armor, heat, overkill | Sum blocked/cost conservation, no iteration advantage; true HP loss chỉ tính một lần | T05/G1 |
| Q07 | Mất thruster/branch/capacitor/radiator | Capability/energy clamp tick đúng; no self accelerates from losing armor; fallback Brain visible | T05/G1 |
| Q08 | Center contested, ring boundary/remainder, timeout ties | Objective chính xác, ring bypass shield,≤100 score gap draw; all terminal precedence fixtures | T05/G1 |
| Q09 |1000 seed Windows/Linux,100browser representative | Exact sim hashes/event ordering, no nondeterministic imports/time | T06/G1 |
| Q10 | Random seek each chunk, restore checkpoint, corrupt bytes | Public playback frame parity; private restore final hash parity; tamper rejected | T06/G1 |
| Q11 | Keyboard/template/MCP/local iteration | User completion≥8/10≤15min; trace one improvement; import errors/undo/conflict/loading clear | T07/G2 |
| Q12 | Art on/off, grayscale, low tier, context loss | Same result; public telegraph readable; texture recovery and seek no stale VFX/audio | T08/G2 |
| Q13 | Two users/clients/CAS/source/jobs/replay/cursor | Cross-owner/scope accesses rejected uniform; stale revision/keys/cursor not overwrite | T09/G3 |
| Q14 | OAuth PKCE/state/redirect/issuer/audience/CSRF/Origin | Invalid grants rejected; valid same subject web/MCP; metadata fetch no SSRF | T09/G3 |
| Q15 | Lease crash at every phase, stale worker/signature | At-least-once work yields one authorized result; no stale commit/charge | T10/G3 |
| Q16 | Modern MCP protocol+two actual hosts | Observed wire2026-07-28, full co-create; legacy independent; Apps unrun explicitly | T11/G3 |
| Q17 | Forged/GET/expired/hash/client/grant human intent | No ranked entry; approved POST consume once under concurrency | T11,G4 |
| Q18 |2 legs/series races/rating/season close/ledger correction | Exact fixtures07, zero-sum, no duplicate delta, immutable snapshot | T12/G4 |
| Q19 |4200 reference matches+holdout/adversarial bots | Metrics02, clear counterplay, same-body Brain improvements; measured uncertainty | T13/G4 |
| Q20 | Capacity/restore/rollback+permission/privacy scans | Budget profiles và drill evidence, mandatory security controls below | T14/G4 |

Property test adversarial bounds: max-size24 modules+2048 IR, thin branches/core edge, projectile crowd≤128, simultaneous3 weapons, all objects collide, tie angles, integer extreme within schema. Minimize failing seed and store regression fixture; not merely rerun random until green.

## 3. Game feel và intelligence gate

Design perception là measurement, không designer tự chấm10/10. Ít nhất12 người đa dạng kinh nghiệm, video scenario normal/low VFX, không hiện log;≥80% nhận đúng đội, windup, module mất và bước ngoặt. Ghi nhiệm vụ, câu trả lời thật, assistance và device. Nếu dùng12 người, “≥80%” nghĩa≥10/12, báo counts; nhiều nhiệm vụ report từng task chứ không average che yếu.

10 người mới làm loop tạo→sửa→thử→debrief≤15 phút;≥8 hoàn thành. Người không MCP phải có route web; host lỗi không chặn workflow template. Chỉ số thích thú/return intent khảo sát giúp chọn hướng nhưng không thay retained behavior sau closed alpha. Không tối ưu match win rate mà bỏ agency người chơi.

Intelligence test dùng 3 cặp default/adaptive Brain trên cùng Body, opponent và binding. Mỗi cặp phải đạt mean leg score improvement ≥0.15 theo pass rule dưới đây; lời diễn giải về chiến lược không là một cách pass thay thế. Report ghi n, Wilson 95% cho win rate riêng từng variant, paired effect và trace. Không chọn lại kịch bản sau khi biết kết quả. Counterfactual analysis cần experiment thật.

**Pass rule đăng ký trước:** mỗi cặp có ít nhất 200 kịch bản holdout khác nhau theo seed → preset mapping của 02. Mỗi kịch bản chạy cả baseline/candidate ở hai slot assignments: 800 legs/cặp. Metric trên một kịch bản là average leg score (win 1, draw 0.5, loss 0). Paired difference = candidate − baseline; point estimate ≥0.15 và paired bootstrap 95% lower bound >0. Dùng 10.000 resamples với bootstrap seed cố định trong report. Wilson chỉ mô tả win rate của từng variant, không thay paired significance. Holdout scenario IDs và seeds không được dùng để tune trước gate; nếu một cặp fail, không thay opponent/kịch bản sau khi xem kết quả. Tổng là 2.400 legs ngoài 4.200 reference matrix, chạy CLI/CI với release budget riêng.

## 4. Performance targets và phương pháp

Các số là **target**, phải có recording trong exact release revision. Máy tham chiếu ban đầu: desktop4 logical cores,8 GiB RAM, integrated GPU/WebGL2,1080p,DPR1; mobile midrange Android6GiB, viewport390×844,DPR capped1.5 low tier. T14 ghi model hardware thật thay mô tả generic; thêm Chrome/Edge/Firefox/Safari supported versions release matrix, không claim Safari từ Chromium emulation.

| Hạng mục | Mục tiêu alpha | Đo |
|---|---|---|
| Viewer desktop | p95 frame≤16.7ms, p99≤33.3ms trong2phút stress replay | Browser/GPU timing, actual120s, asset tier ghi rõ |
| Viewer mobile low | p95≤33.3ms, controls usable | Actual device, không desktop resize alone |
| Renderer allocation | Stable memory, no monotonic>10 MiB/10 repeated replays | Heap+GPU budget traces sau GC hợp lệ |
| Viewer seek | p95≤150 ms warm chunk,≤500 ms cached manifest read |100 random seeks; cold network separate |
| Initial download | App shell≤400 KiB gzip, slice initial assets≤8 MiB | Bundle/network report, fonts included |
| API metadata writes | p95≤300 ms excluding job execution | k6 concurrency20; dataset+request mix ghi rõ |
| Full90s leg compute | p95≤5s on recorded4vCPU worker reference | max-complexity fixtures + normal; pool sizing measured |
| Ready pool 20 subjects ranked | queue delayp95≤30s, both legs completionp95≤15s after matched | Separate matchmaking wait vs CPU queue |
| Replay | Public≤8 MiB/leg;≤16 MiB private | Worst legal sim; privacy and bounded decode checked |
| Failure rate | <1% infra errors in30min controlled load | report HTTP/job failure separately, not hide retries |

Giả định năng lực cho series: 20 người tạo tối đa 10 series đồng thời, tức 20 legs. Với mỗi leg có p95 mục tiêu ≤5 giây, cấu hình tham chiếu chọn **4 worker hosts × 4 vCPU**, mỗi host chạy 3 processes: tổng 12 slots, API chạy riêng. Hai đợt xử lý ×5 giây ≈10 giây, dành thêm 5 giây cho dispatch/storage/finalize; mục tiêu hoàn thành ≤15 giây trên warm pool vẫn phải đo.

Stress test với 40 người, 20 series và 40 legs dùng **7 hosts × 4 vCPU**, tổng 21 slots, hoặc cấu hình có năng lực tương đương đã đo. Hai đợt vẫn nhắm khoảng 10 giây xử lý +5 giây overhead. Một host 4 vCPU chỉ có 3 slots: thời gian xử lý tối thiểu theo giả định 5 giây/leg là khoảng 35 giây cho 20 legs và 70 giây cho 40 legs. Nếu alpha chỉ đủ ngân sách một host, công bố latency đã đo và giới hạn admission/người tham gia trước khi mời người dùng. T14 phải ghi chi phí/CPU-hour, utilization, queue wait và chi phí pool nhàn rỗi; mọi cấu hình vẫn phải đạt integrity gates.

Load normal/spike/soak: start20 subjects;10 simultaneous series/20subjects ở normal load và20series/40subjects ở stress, worker pool theo capacity assumption trên;100 lab jobs requested across subjects while quotas applied; soak30min recording DB lock/lease/retry/rating integrity. Admission/queue errors expected rate-limit riêng từ infrastructure failure. If capacity fails, giảm public concurrency/alpha participant cap có UX rõ hoặc optimize; không disable replay/protocol validation. Browser frame budget và compute targets không transferable sang mọi thiết bị hoặc VPS v1.

## 5. Accessibility và i18n

DOM UI WCAG2.2 AA target: body text≥4.5:1, UI graphical boundaries≥3:1, focus visible, keyboard commands/undo, labels/live-region cho validation/job status, reduced motion, mute/audio volume, no color-only team/module meaning, ≥44×44 touch controls mục tiêu. Canvas có DOM equivalent selected module details và combat event summary; no requirement screen reader infer particles. Test keyboard actual flows+axe plus manual reading, grayscale/color deficiency simulation và measured tokens; one axe pass không proof all AA.

Vietnamese/English strings separated, no copy in engine; Inter/Noto Sans fonts Vietnamese glyph coverage self-host licenses, time display user timezone, data timestamps UTC. Text overflow/name Unicode/changing locale while replay tests. Screens responsive layouts06 do actual viewport checks including320px; full geometry editor limitations mobile rõ, content vẫn accessible.

## 6. Threat model, phạm vi và controls

Review thiết kế dùng STRIDE và OWASP Top10 edition2021 để đặt coverage (không claim latest2026 taxonomy hoặc code vulnerabilities). Assets: private Brain/trace, identity/grants, package integrity, simulation resources, official result/rating, signing keys. Actors: malicious player/model/tool input, curious opponent, compromised client/worker, content author, privileged operator. Trust zones: browser/host→adapter→application→DB/jobs→sandbox→supervisor/finalizer→public CDN. Role/artifact specialist ở raw security, findings là **threats lý thuyết**, chưa exploit verified.

| Threat | STRIDE / OWASP2021 | Control cần có / evidence |
|---|---|---|
| Cross-owner object/resource | S/I/E,A01 | Subject+scope+ACL every read/write/export/blob, two-user negative tests |
| Expression/macro/parser DoS | D,A04/A05 | Bounds trước parse/inline allocation, compile work cap/deadline, fuzz stress reject |
| Worker crash/escape/egress | E/D,I,A05/A06 | OS sandbox readonly/no secret/no network, image provenance, resource limits, actual forbidden syscall/network test |
| Package/result/engine spoof | T/R,A08 | Canonical hash+trusted signed release, pin complete manifest, result key distinct, rotation/revocation/tamper tests |
| Private source leak via replay/log/cache | I,A01/A02/A09 | Public projection allowlist, private chunks/cache ACL, automated canary secrets in all surfaces |
| OAuth/intent confused deputy | S/E,A07/A01 | PKCE/audience/scope/client grant+web one-use intent, expiry/revoke, no GET approval, concurrency tests |
| Metadata/icon/storage arbitrary URLs SSRF | S/I,A10 | Registry references not user fetch; client metadata exact allowlist, DNS/IP/redirect restrictions, negative localhost/link-local tests |
| Double settlement/quota leakage | T/R,D,A04/A08 | Fencing/outbox/receipt+DB uniqueness, both legs verified, crash-point/fault injection |
| Abuse/collusion/unsafe admin | R/E,D,A04/A09 | Quota/rate limits, audited RBAC/MFA/admin pause/appeal, bounded repeat pair policy |

**Metadata fetching:** default closed-alpha allowlist auth client metadata origins registered by operator; cache by validated issuer/client. Resolver block loopback/private/link-local/multicast/cloud metadata IPv4/IPv6, pin DNS result through connect to prevent rebinding, HTTPS only, no redirects by default, max body 64KiB/timeout2s, validate content/schema, no cookies/credentials forwarded. If host requires dynamic CIMD onboarding, approved public origins only; inability to enforce safely means disable dynamic fetch, use supported registered clients. Never generic fetch tool from AI input.

**Replay privacy:** seed/body/results public, Brain/IR/state/rule/var/sourceMap private. Public codec allowlist not “remove Brain field” blacklist. Inject synthetic canary into private fields and assert not present in public manifest/chunks/tool errors/CDN URLs/logs; exact hidden resources không emit telemetry. Public HP/telegraph flags allowed, exact enemy resource snapshot not. Permission-limited URLs expire≤5min, logs redact query credentials; signed URL revocation limitation documented (expiry window), private data sensitive use authenticated proxy when immediate revoke needed.

**Auth/account:** secure provider, no custom crypto, password support only if backed by provider verified, bot owned subject cannot be changed by patch. Grant scope acts independently from session, refresh rotate/revoke. Do not forward bearer to external icon/metadata servers. OAuth/GitHub/project secrets never saved in BotDefinition, DSL, examples or repo.

## 7. Security gates cho T14

- **SG-CONTRACT:** bounds/fuzz reject tests, unknown fields/keys, canonical all runtimes.
- **SG-ISOLATION:** actual job no egress/no secrets/readonly and resource enforcement; worker-thread alone fail.
- **SG-INTEGRITY:** forged release/result signature, old/revoked keys, digest mismatch, corrupt artifacts rejected/quarantined.
- **SG-PRIVACY:** canary negative checks every public projection/cache/log/blob, scope/owner export correctness.
- **SG-AUTH-INTENT:** OAuth negative matrix, CSRF/Origin, client/audience revoke, one-use hash/season intent concurrency.
- **SG-AUTH-INTENT bổ sung:** duplicate approve POST chỉ cùng handle/expiry, unique intent/review, approve/revoke/consume CAS một row; consumed review không reapprove để submission thứ hai.
- **SG-SETTLEMENT:** every crash point/enqueue/lease/upload/finalize/both legs/rating/outbox/cancel quota race, one trusted settlement.
- **SG-SETTLEMENT correction:** versioned ledger rebuild watermark, settlement pause/drain, atomic active-run+snapshot switch, retry/rollback không mất hay nhân series.
- **SG-EGRESS:** metadata SSRF redirects/DNS/IP/IPv6 attempts blocked, sandbox egress actually denied.
- **SG-ABUSE-RECOVERY:** per-user/client/IP quotas, repeat pairs, admin audit, restore+pause drills, attack load has no unbounded queue.
- **SG-EXTENSION:** authored hooks no I/O, bounded entities/work/state codec, signed catalog allowlist, mechanics not hot-load user code.

Signature round-trip alone does not prove provenance if attacker selects key; tests trust anchor registry, issuance and revocation. Package digest alone does not prove player authorization. A backup file alone does not prove recoverability. No unsigned skip/TLS checksum bypass or “internal network therefore trusted” shortcut.

## 8. Release và rollback

**Go cho closed ranked alpha:**G0–G4 đạt cho exact revision; no unresolvedP0/P1 correctness/security/privacy;2 actual named MCP hosts tool loop verified; balance/readability/perf gates achieved; deployed auth+same-origin+signature+restore; engineer responsible review decisions. Apps support gated nếu chưa render thật, không chặn tools-based game; ranked intent hoặc worker integrity unverified chặn ranked.

Pre-release checklist: content/catalog/schema/agent.md cùng digests; migrations expand compatible; worker image/release signatures verified; object ACL+cache headers; sample player loop staging; counterbalanced series+ledger smoke; all admin pause toggles/alerts; source licenses; known limits/retention/help; fresh-machine setup+startup verified. Không gọi deploy/publish bằng chứng chỉ bởi kế hoạch này.

Rollback: pause admissions→drain/quarantine in-flight→restore last compatible image+content bindings→verify completed ledger/read replay→reopen subset after smoke. Không restart worker khác engine để làm tiếp manifest cũ. Destructive DB migration không rollback tự động; PITR staging drill trước contract migration. Rating corrections dùng rebuild policy07, không delete rows qua ad-hoc script. Feature flags catalog/Apps/quality riêng, không dùng flags để bỏ authorization.

## 9. Retention và quyền người chơi

Alpha defaults: idempotency receipts7 ngày (ranked giữ mùa+dispute), audit/security logs90 ngày, private decision trace/experiment blobs30 ngày, official public replay180 ngày, result/manifest/rating ledger+engine/content artifact giữ lâu để audit. Storage projections/cost phải đo trước hứa indefinite video/replay; nếu public replay hết hạn giữ result+integrity manifest, UI nói unavailable và không hứa full re-sim không còn inputs.

Full private packages cần cho dispute/verify retained season+180 ngày, encrypted at rest, operator access audited. Account delete: xóa draft/private practice data theo policy, revoke grants, pseudonym public author; official records keep tối thiểu có lý do integrity, không giữ private source vô hạn không cần. Policy và retention phải được owner chấp thuận khi mở sản phẩm, không suy là legal compliance đã xác minh. Bản sao tại AI host nằm ngoài quyền kiểm soát của platform; consent05 nói rõ.

## 10. Báo cáo gate

```text
Gate / revision / bindings / environment:
Executed: test counts, functional requests, exact commands/exits
Passed / Failed / Expected-failure / Skipped / Unrun:
Artifacts: seed manifests, logs, screenshots, wire captures, measured metrics
Findings: severity, reproducible evidence, owner, correction and reverify
Decision: Go / Conditional Go / No-Go and concrete next ticket
```

Hiện tại **Go để bắt đầu T01**, **No-Go để công bố game/ranked đã sẵn sàng**. Review tài liệu giảm mâu thuẫn trước code, không thay các gate thực thi này.
