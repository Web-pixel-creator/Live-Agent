# Tasks Document

## Goal

План реализации для `.kiro/specs/multimodal-agents/requirements.md` с приоритетами, зависимостями и оценкой по неделям.

## Priority Legend

- **P0**: обязательно для MVP и подачи на челлендж.
- **P1**: важно для V2 (production hardening).
- **P2**: долгосрочные расширения V3.

## Milestones and Timeline

- **M1 (Week 1)**: платформа + Live Agent MVP.
- **M2 (Week 2)**: Creative Storyteller + UI Navigator + Multi-Agent demo.
- **M3 (Week 3-6)**: V2 hardening.
- **M4 (Week 7-12+)**: V3 ecosystem expansion.

## Phase M1: Platform Foundation + Live Agent MVP (Week 1)

| ID | Task | Priority | Estimate | Dependencies | Related Requirements | Definition of Done |
| --- | --- | --- | --- | --- | --- | --- |
| T-000 | Реализовать Minimal Demo Frontend (WebSocket + mic capture/playback + transcript + KPI panel) | P0 | 1 day | T-001 | R1, R3, R14, R15 | Есть рабочая web-страница демо: соединение с gateway, захват/проигрывание аудио, видимый transcript и KPI/constraint panel, а также lifecycle-индикатор ассистента (`waiting_connection/idle/streaming/speaking`) и policy-proof `assistantActivityLifecycleValidated=true` |
| T-001 | Инициализировать сервисы проекта (API gateway, agent runtime, frontend shell) | P0 | 1 day | None | R0, R10, R11 | Запускаются локально и в cloud окружении, есть health endpoints |
| T-002 | Настроить GCP baseline (Project/IAM/Secrets/Service Accounts) | P0 | 0.5 day | T-001 | R11, R13 | Все сервисы аутентифицируются через IAM, секреты вынесены в Secret Manager/env |
| T-003 | Поднять Firestore схемы: sessions, events, negotiation_logs, assets | P0 | 0.5 day | T-002 | R1, R3, R4, R11, R16 | CRUD проходит, индексы созданы, TTL/retention правила заданы |
| T-004 | Реализовать ADK orchestration skeleton (agent registry + routing) | P0 | 1 day | T-001 | R0, R10, R16 | Live_Agent, Storyteller, UI_Navigator зарегистрированы и доступны через router |
| T-005 | Реализовать Live API streaming gateway (stateful WebSocket + setup/audio/turn protocol) | P0 | 2.5 day | T-002, T-004 | R1, R12 | Есть setup message с model profile, PCM framing/chunking, turn assembly, interruption propagation и устойчивый reconnect |
| T-006 | Добавить native interruption handling (`interrupted` events) | P0 | 0.5 day | T-005 | R1, R12 | Воспроизведение останавливается на прерывании, есть интеграционные тесты |
| T-007 | Реализовать базовый live translation mode | P0 | 0.5 day | T-005 | R2 | Автоопределение языка и перевод на целевой язык работают в live-сессии |
| T-008 | Реализовать negotiation mode с constraint-policy и audit logging | P0 | 1 day | T-003, T-004 | R3 | Предложения и контрпредложения логируются в Firestore, финал требует user confirm |
| T-009 | Включить минимальный observability слой (logging/metrics/alerts) | P0 | 0.5 day | T-001, T-002 | R15 | Есть `/metrics` endpoints для gateway/api/orchestrator c p50/p95/p99 и error rate, а также автоматическая e2e-проверка метрик (`runtime.metrics.endpoints`) |
| T-010 | Добавить единый реестр активных задач и realtime-прогресс событий | P1 | 0.5 day | T-004, T-005 | R10, R12, R14, R15 | Для долгих операций выдается `taskId`, есть `/tasks/active` + `/tasks/{taskId}`, прогресс стримится событиями `task.started/task.progress/task.completed/task.failed` в UI, финальный `task.status` сохраняется в Firestore |
| T-011 | Реализовать lifecycle endpoints рантайма (status, warmup, drain, health, version) | P1 | 0.5 day | T-001, T-002 | R10, R11, R14, R15 | Операционные endpoints (`/status`, `/warmup`, `/drain`, `/healthz`, `/version`) доступны для gateway/api/orchestrator; drain-mode блокирует новые бизнес-запросы; runtime profile/version фиксируются в ответах |
| T-012 | Ввести границу capability-адаптеров (live, reasoning, tts, image, video, computer_use) | P1 | 1 day | T-004 | R0, R10, R11 | Бизнес-логика использует единый internal interface (`@mla/capabilities`), Gemini/Vertex adapters заданы по умолчанию, а e2e policy проверяет `kpi.capabilityAdaptersValidated=true` |
| T-013 | Усилить remote execution split и session/run binding между FE/Gateway/Orchestrator | P0 | 0.5 day | T-005 | R10, R12, R13, R14 | Gateway вводит websocket session/user binding (mismatch protection), UI получает явные `session.state` transitions, а e2e policy проверяет `sessionRunBindingValidated=true` и `sessionStateTransitionsObserved>=3` |
| T-014 | Внедрить минимальную дисциплину API-контрактов (contracts + normalized errors) | P0 | 0.5 day | T-001, T-005, T-013 | R14, R15 | Контракты обновлены и ошибки в API/WS возвращаются в едином формате с traceId |
| T-015 | Добавить CI workflow для demo e2e и публикации отчетных артефактов | P0 | 0.5 day | T-000, T-014 | R14, R15 | CI запускает `demo:e2e`, публикует `summary.json`, `summary.md` и service logs как artifacts |
| T-016 | Добавить PR template с demo-readiness checklist для review gate | P0 | 0.25 day | T-015 | R14, R15 | Каждый PR содержит обязательный checklist: e2e workflow pass, ссылки на artifacts и KPI-верификацию |
| T-017 | Добавить автоматический KPI policy-check gate для demo отчетов | P0 | 0.25 day | T-015, T-016 | R14, R15 | CI падает, если ключевые KPI в `summary.json` не соответствуют policy (`negotiation`, `gateway ws`, `approvals`); публикуются `policy-check.md`, `policy-check.json` и `badge.json` |
| T-018 | Добавить публикацию публичного endpoint badge в `gh-pages` | P0 | 0.25 day | T-017 | R15 | На push в `main/master` CI публикует `demo-e2e/badge.json` в `gh-pages`; README содержит рабочий шаблон URL для Shields endpoint; добавлены скрипты `badge:pages:enable` и `badge:pages:check` |
| T-019 | Добавить automated release/publish scripts (`verify:release`, `repo:publish`) | P0 | 0.25 day | T-018 | R14, R15 | Есть единый локальный quality gate и scripted git publish flow с optional Pages + badge verification |

### Quality-First Scope Gate (M1)

| Scope | Subtask | Work Item | Why |
| --- | --- | --- | --- |
| Keep in M1 (P0) | T-000.1 | WebSocket UI + transcript + KPI panel | Без UI невозможно judged demo |
| Keep in M1 (P0) | T-005.1 | Live setup message + model profile selection | Базовая совместимость с Gemini Live |
| Keep in M1 (P0) | T-005.2 | PCM chunking/framing + turn assembly | Критично для голосового контура |
| Keep in M1 (P0) | T-006.1 | Interruption stop path end-to-end | Must-have для Live Agent |
| Keep in M1 (P0) | T-007.1 | Real-time translation happy path | Demo value |
| Keep in M1 (P0) | T-008.1 | Negotiation constraints + audit | Demo value и безопасность |
| Keep in M1 (P0) | T-013.1 | Correlation IDs (`userId/sessionId/runId/taskId`) | Отладка и traceability |
| Keep in M1 (P0) | T-014.1 | Contract sync + normalized errors | Стабильность интеграций |
| Keep in M1 (P0) | T-015.1 | CI demo artifact pipeline (`summary.json` + `summary.md` + logs) | Judge-ready reproducibility |
| Keep in M1 (P0) | T-016.1 | PR demo-readiness checklist gate | Снижение риска “непроходимого” PR перед submission |
| Keep in M1 (P0) | T-017.1 | KPI policy gate (`demo:e2e:policy`) | Автоматический стоп при регрессии judge-critical метрик |
| Keep in M1 (P0) | T-018.1 | Public badge publishing (`gh-pages`) | Внешняя прозрачность статуса demo-ready для judges/reviewers |
| Keep in M1 (P0) | T-019.1 | Scripted release/publish flow | Минимизация ручных ошибок при подготовке и публикации demo baseline |
| Defer to M3 (P1) | T-010.* | Task registry + progress plane | Nice-to-have для MVP |
| Defer to M3 (P1) | T-011.3/T-011.4 | warmup/drain + lifecycle smoke | Production hardening |
| Pulled into M1 | T-012.* | Capability adapter layer | Нужен ранний adapter boundary для безопасного failover/profile switching в judged demo |
| Defer to M3 (P1) | T-013.3/T-013.4 | reconnect dedupe + E2E suite | Hardening после MVP |
| Defer to M3 (P1) | T-014.2/T-014.4 | typed client generation + schema drift CI | Не блокирует judged сценарий |

## Phase M2: Storyteller + UI Navigator + Challenge Demo (Week 2)

| ID | Task | Priority | Estimate | Dependencies | Related Requirements | Definition of Done |
| --- | --- | --- | --- | --- | --- | --- |
| T-101 | Реализовать Story Planner (Gemini 3 Pro) + branch continuation (Gemini 3 Flash) | P0 | 1 day | T-004 | R4, R5 | История строится по аркам и ветвится по пользовательским выборам |
| T-102 | Интегрировать Imagen 4 pipeline для генерации иллюстраций | P0 | 0.5 day | T-101 | R4 | На каждый story segment генерируется и сохраняется image asset reference |
| T-103 | Интегрировать Veo 3.1 pipeline для видео-сцен | P1 | 1 day | T-101 | R4 | Видео-сцены генерируются асинхронно и корректно линкуются в контент-поток |
| T-104 | Интегрировать Gemini TTS с style prompts и sync timeline | P0 | 0.5 day | T-101 | R4, R5 | Нарация синхронизирована с текстом/визуалом, стиль голоса управляется |
| T-105 | Реализовать Computer Use planning loop (screenshot -> actions) | P0 | 1 day | T-004 | R6, R7 | Модель возвращает action sequence (click/type/scroll) по текущему скриншоту |
| T-106 | Реализовать Action Executor на Playwright + self-correction loop | P0 | 1 day | T-105 | R6, R7, R8 | После каждого шага делается verify screenshot и auto-recovery при сбоях |
| T-107 | Добавить sensitive-action approval gates для UI Navigator | P0 | 0.5 day | T-106 | R6, R13, R16 | Опасные действия блокируются до явного подтверждения пользователя |
| T-108 | Реализовать visual testing mode и отчёты регрессий | P1 | 0.5 day | T-106 | R9 | Генерируется структурированный отчёт с severity и screenshot artifacts |
| T-109 | Реализовать multi-agent delegation (Live -> UI/Storyteller) | P0 | 0.5 day | T-004, T-106, T-104 | R16 | Делегирование задач работает с общим контекстом и trace событий |
| T-110 | Подготовить demo-сценарии для трёх категорий челленджа | P0 | 0.5 day | T-109, T-112 | R1-R16 | Есть воспроизводимый demo script (`scripts/demo-e2e.ps1`), fallback путь задокументирован, judge-oriented walkthrough оформлен в `docs/challenge-demo-runbook.md` |
| T-111 | Реализовать demo control panel (targets/current/final), interruption checkpoints и stage fallback runbook | P0 | 0.5 day | T-008, T-110 | R1, R3, R13, R15 | В UI видны ограничения и KPI, interruption-план воспроизводим (`gateway.websocket.interrupt_signal`), fallback в text-mode документирован и протестирован |
| T-112 | Подготовить pre-generated media fallback pack для Storyteller demo | P0 | 0.5 day | T-102, T-104 | R4, R5, R15 | Для каждого demo-сценария есть заранее подготовленные image/video/audio ассеты на случай деградации API |

## Phase M3: V2 Hardening (Week 3-6)

| ID | Task | Priority | Estimate | Dependencies | Related Requirements | Definition of Done |
| --- | --- | --- | --- | --- | --- | --- |
| T-201 | Добавить profile-aware model failover (cooldowns, billing disable windows) | P1 | 1 week | T-005, T-009 | R10, R12, R15 | Live bridge классифицирует причины сбоев (transient/rate_limit/auth/billing), применяет profile/model cooldown+disable windows и прозрачно переключает route с диагностикой failover events |
| T-202 | Добавить skills runtime (workspace/bundled/managed) и skill precedence | P1 | 1 week | T-004 | R10, R16 | Реализован runtime loader для `workspace/bundled/managed` c precedence+policy gating (scope/allowlist/denylist), а активные skill directives инжектируются в prompt flows агентов с диагностикой в output |
| T-203 | Добавить skill security scanner и install-time trust gates | P1 | 0.5 week | T-202 | R13, R15 | Skills runtime выполняет security scan (`off/warn/enforce`) и trust gates (`SKILLS_MIN_TRUST_LEVEL`), блокируя небезопасные/недоверенные навыки до активации с явной диагностикой причин |
| T-204 | Реализовать sandbox policy modes для non-main/high-risk sessions | P1 | 1 week | T-106 | R13, R16 | UI Navigator поддерживает режимы `off/non-main/all`, применяет policy-ограничения (allowed actions, max steps, forced executor, blocked categories), а e2e KPI валидирует `sandboxPolicyValidated=true` |
| T-205 | Расширить execution traces и audit dashboard | P1 | 0.5 week | T-009, T-109 | R15, R16 | `/v1/operator/summary` содержит trace rollup (runs/events, tool steps, screenshot refs, approval links), UI operator console отображает его, а e2e policy валидирует `operatorTraceCoverageValidated=true` |
| T-206 | Добавить performance/load test suite для live voice + UI navigation + gateway replay/dedupe | P1 | 0.5 week | T-005, T-106 | R1, R6, R12, R14, R15 | Автоматизированный профиль нагрузки с отчётом p95 latency, replay/dedupe контрактом и error budget |
| T-207 | Вынести долгие Veo/Imagen jobs в dedicated workers с quota-aware scheduling | P1 | 1 week | T-103, T-010 | R4, R10, R15 | Медиа-джобы выполняются отдельными воркерами, есть retry budget и видимость очередей |
| T-208 | Добавить детерминированный кэш для story assets/prompt variants и policy invalidation | P1 | 0.5 week | T-102, T-103, T-207 | R4, R5, R15 | Повторные запросы дают cache-hit, при смене model/version кэш инвалидируется консистентно |
| T-209 | Добавить local-first dev profile (non-production) для офлайн-итераций | P1 | 0.5 week | T-011, T-014 | R10, R14 | Отдельный dev profile существует, отключен policy в prod/staging и не влияет на challenge baseline |
| T-210 | Собрать operator console (active tasks, approval queue, health summary, startup diagnostics, cancel/retry/failover) | P1 | 0.5 week | T-205, T-010, T-011 | R10, R13, R15 | Оператор видит активные процессы, startup-failure состояние (`startupFailures`) и может выполнять recovery-действия с полным audit trail; e2e policy валидирует `operatorStartupDiagnosticsValidated=true` |
| T-211 | Live bridge hardening: richer Gemini setup + profile/auth failover + channel watchdog | P0 | 0.5 week | T-005, T-009 | R1, R12, R15 | Gateway поддерживает model/auth failover chain, расширенный setup payload, health degradation detection и recovery events |
| T-212 | UI Navigator loop protection (tool/action loop detection + hard stop) | P0 | 0.25 week | T-106 | R6, R7, R8, R13 | Зацикливание однотипных действий детектируется sliding-window логикой, выполнение останавливается с явной диагностикой |
| T-213 | Approval lifecycle SLA runtime (pending/approved/rejected/timeout + audit trail) | P0 | 0.5 week | T-107, T-210 | R13, R15, R16 | Approval records имеют полный жизненный цикл и SLA sweep (soft reminder + hard timeout), оператор видит audit trail |
| T-214 | Protocol discipline pass: ws-protocol doc + MVP transport sync in specs | P0 | 0.25 week | T-014 | R12, R14, R15 | Добавлен единый `docs/ws-protocol.md`; design/requirements синхронизированы с WebSocket-only MVP |
| T-215 | Targeted unit-pack for bridge/orchestrator/contracts | P0 | 0.5 week | T-211, T-212, T-213, T-214 | R14, R15 | Критические ветки покрыты unit-тестами, e2e остаётся primary release gate |
| T-216 | Session optimistic versioning + idempotency for REST mutations | P0 | 0.25 week | T-014, T-213 | R14, R15 | `PATCH /v1/sessions/{id}` поддерживает `expectedVersion` + `idempotencyKey`, возвращает `409` на конфликт и детерминированно обрабатывает повтор |
| T-217 | Live Agent context compaction runtime (summary + recent turns) | P0 | 0.25 week | T-211, T-215 | R1, R10, R15 | При превышении token budget выполняется compaction c сохранением summary/recent turns и диагностикой в output context; e2e policy подтверждает `liveContextCompactionValidated=true` |
| T-218 | Gateway/Orchestrator idempotent request dedupe + session serial lane | P0 | 0.25 week | T-211, T-215, T-216 | R12, R14, R15 | Gateway обрабатывает WS-сообщения последовательно по session lane, duplicate `orchestrator.request` переигрываются из TTL cache, orchestrator дедуплицирует in-flight/completed по `runId/idempotencyKey` |
| T-219 | Local Live API Echo Mock for offline UI/runtime development | P0 | 0.25 week | T-209, T-211 | R10, R12, R14 | Добавлен локальный WebSocket mock (`apps/live-api-echo-mock`) для Gemini Live-подобного протокола; local-first сценарии могут валидировать `connected/output/interrupted/turn_complete` без внешних ключей и квот |
| T-220 | UI Navigator grounding upgrade: Screenshot + DOM/A11y + Set-of-Marks hints | P0 | 0.5 week | T-106, T-212 | R6, R7, R8, R15 | Планировщик/исполнитель UI действий принимает не только screenshot, но и структурированный DOM/a11y snapshot и mark hints; e2e фиксирует рост устойчивости кликов/локаторов |
| T-221 | Telemetry storage split: Firestore state vs analytics sinks (Cloud Monitoring/BigQuery) | P1 | 0.5 week | T-009, T-205 | R11, R15 | Состояние/approval/session остаются в Firestore; метрики и event rollups экспортируются через structured analytics logs для routing в Cloud Monitoring/BigQuery, policy задокументирована в `docs/telemetry-storage-split.md` |
| T-222 | Assistive LLM router with confidence gate and deterministic fallback | P1 | 0.5 week | T-004, T-109 | R10, R16 | Добавлен дополнительный router на `gemini-3-flash` под feature flag; при low-confidence сохраняется deterministic routeIntent, а routing diagnostics документированы в `docs/assistive-router.md` |
| T-223 | WebRTC spike and migration plan for Live Agent V2 transport | P2 | 0.5 week | T-211 | R1, R12 | Выполнен технический spike (latency/loss behavior, adapter seam, rollout risks); migration plan зафиксирован в `docs/webrtc-v2-spike.md` без влияния на WebSocket-only MVP |
| T-224 | Realtime envelope correlation pass (`event id` + metadata + gateway error echo) | P0 | 0.25 week | T-214, T-218 | R12, R14, R15 | `EventEnvelope` поддерживает `conversation/metadata`; `gateway.error.details.clientEventId` эхирует клиентский `id`; docs/tests/e2e не дрейфуют |
| T-225 | Interruption truncation pipeline for WebSocket playback clients | P0 | 0.5 week | T-211, T-224 | R1, R12, R14, R15 | Frontend вычисляет `audio_end_ms`, отправляет `conversation.item.truncate`, gateway фиксирует `live.turn.truncated`, а недослушанный хвост не остается в активном turn-state |
| T-226 | Push-to-Talk runtime mode (`live.input.clear/commit`) for noisy environments | P0 | 0.5 week | T-225 | R1, R12, R14 | В UI есть PTT режим (`hold-to-talk`), на press/release отправляются clear/commit события, а сценарий стабилен в e2e |
| T-227 | Out-of-band response lane (`conversation=none` + metadata tagging) | P1 | 0.5 week | T-224, T-222 | R10, R12, R16 | Поддержан side-lane ответов без мутации default conversation; метаданные позволяют связать OOB результат с задачей (router/moderation/classification) |
| T-228 | Realtime function-calling bridge (tools -> skill invocation -> function output) | P1 | 1 week | T-202, T-212, T-227 | R10, R13, R16 | В realtime-сессии поддержаны function-call запросы к skills/capabilities с approval/sandbox guards и audit-трассировкой |
| T-229 | Realtime still-image input lane (`live.image`) for visual grounding prompts | P1 | 0.25 week | T-224, T-225 | R1, R12, R14 | Gateway/bridge принимают `live.image` (base64 и data URL), фронтенд может отправлять image frame, протокол/тесты синхронизированы |
| T-230 | Granular realtime output lane (`live.output.audio.delta` + `live.output.transcript.delta`) | P1 | 0.25 week | T-224, T-229 | R12, R14, R15 | Bridge эмитит отдельные audio/transcript delta события для UI, frontend использует их без дублирования, docs/tests/specs синхронизированы |
| T-231 | Structured conversation item lane (`conversation.item.create`) for multimodal turns | P1 | 0.25 week | T-224, T-229 | R12, R14 | Gateway/bridge принимают `conversation.item.create` с `input_text/input_image/input_audio`, корректно мапят в Gemini `clientContent.turns`, frontend умеет отправлять lane, docs/tests/specs синхронизированы |
| T-232 | Live setup patch lane (`LIVE_SETUP_PATCH_JSON`) for realtime tools/toolConfig overrides | P1 | 0.25 week | T-228, T-231 | R12, R14, R16 | Gateway применяет JSON patch к Gemini setup (tools/toolConfig/generationConfig overrides) с приоритетом runtime `live.setup` override; unit/docs/specs синхронизированы |
| T-233 | Demo frontend audio attachment support for `conversation.item.create` | P1 | 0.25 week | T-231 | R12, R14 | Frontend отправляет `input_audio` part (base64 + mimeType) в `conversation.item.create`, bridge корректно мапит в Gemini inlineData, unit/docs/specs синхронизированы |
| T-234 | Demo frontend live.setup override controls (model/voice/activity/systemInstruction) | P1 | 0.25 week | T-232 | R1, R12, R14 | Frontend позволяет отправить runtime `live.setup` override, ws-протокол и README задокументированы, добавлен unit alignment test на UI/runtime wiring |
| T-235 | Demo frontend UI grounding controls for `ui_task` intent payloads | P1 | 0.25 week | T-220 | R6, R7, R14, R15 | Frontend передает `url/deviceNodeId/screenshotRef/domSnapshot/accessibilityTree/markHints` в `orchestrator.request` для `ui_task`, документация синхронизирована, добавлен unit alignment test |
| T-236 | Frontend gateway.error correlation context for pending client events | P1 | 0.25 week | T-224 | R14, R15 | Frontend связывает `details.clientEventId` с локальным pending-event буфером и показывает `clientEventType/conversation/latencyMs`; добавлены TTL-prune/cleanup hooks и unit alignment tests |

### M3 Detailed Implementation Checklist (T-207..T-210)

| Subtask ID | Parent | Work Item | Estimate | Dependencies | Definition of Done |
| --- | --- | --- | --- | --- | --- |
| T-207.1 | T-207 | Спроектировать worker topology и очереди для Veo/Imagen jobs | 4h | T-103, T-010 | Есть схема очередей, воркеров и SLA по типам медиа-джоб |
| T-207.2 | T-207 | Реализовать dispatcher с quota-aware scheduling (per-model/per-project limits) | 6h | T-207.1 | Очередь учитывает лимиты и не допускает quota burst |
| T-207.3 | T-207 | Реализовать job state machine (queued/running/retry/succeeded/failed) с retry budget и DLQ | 6h | T-207.2 | Ошибочные джобы попадают в DLQ, retry ограничен политикой |
| T-207.4 | T-207 | Добавить мониторинг очередей (lag, fail rate, retries) и alert rules | 3h | T-207.3, T-009 | Есть dashboard и алерты на рост backlog/failures |
| T-208.1 | T-208 | Зафиксировать deterministic cache key schema (model/version/prompt/locale/style) | 2h | T-102, T-103 | Ключ кэша формализован и покрыт тест-кейсами |
| T-208.2 | T-208 | Реализовать cache store/lookup с TTL и size limits для story assets | 4h | T-208.1 | Кэш работает в read/write режиме, соблюдаются лимиты хранения |
| T-208.3 | T-208 | Реализовать policy invalidation (model/version change + manual purge) | 3h | T-208.2 | При смене версии модели старые записи инвалидируются корректно |
| T-208.4 | T-208 | Добавить cache metrics (hit/miss/eviction) и correctness tests | 2h | T-208.2, T-208.3 | Метрики видны в мониторинге, тесты подтверждают консистентность |
| T-209.1 | T-209 | Определить границы local-first профиля и матрицу отключенных прод-фич | 2h | T-011, T-014 | Есть документ профиля с явными ограничениями |
| T-209.2 | T-209 | Реализовать env presets и guardrails, блокирующие local-first в staging/prod | 3h | T-209.1 | Попытка запуска local-first вне dev завершается отказом |
| T-209.3 | T-209 | Добавить mock/stub connectors для офлайн-итераций (без боевых ключей) | 4h | T-209.2 | Основные dev-сценарии выполняются без внешних API |
| T-209.4 | T-209 | Добавить smoke tests переключения профилей dev/staging/prod | 2h | T-209.2, T-209.3 | CI подтверждает корректное поведение профилей |
| T-210.1 | T-210 | Спроектировать IA operator console (tasks, approvals, health, actions) | 2h | T-205, T-010 | Есть wireframe/flow и список обязательных виджетов |
| T-210.2 | T-210 | Реализовать backend endpoints для operator actions (cancel/retry/failover) с RBAC | 5h | T-210.1, T-011 | Операции доступны только ролям оператора/админа |
| T-210.3 | T-210 | Реализовать UI-экран operator console и действия с confirm-dialogs | 5h | T-210.2 | Оператор может выполнять управляемые recovery-действия из UI |
| T-210.4 | T-210 | Добавить audit trail для операторских действий и E2E тесты runbook-сценариев | 3h | T-210.2, T-210.3 | Каждое действие логируется (`operatorActions.recent`), E2E policy подтверждает `operatorAuditTrailValidated=true` |
| T-210.5 | T-210 | Добавить startup diagnostics виджет и summary-контракт в operator console | 2h | T-210.2, T-210.3 | `/v1/operator/summary` возвращает `startupFailures` (`status/total/blocking/recent`), UI отображает `Startup Failures`, а E2E policy подтверждает `operatorStartupDiagnosticsValidated=true` |

## Phase M4: V3 Ecosystem Expansion (Week 7-12+)

| ID | Task | Priority | Estimate | Dependencies | Related Requirements | Definition of Done |
| --- | --- | --- | --- | --- | --- | --- |
| T-301 | Добавить multi-channel adapters (например Telegram/Slack/WebChat) | P2 | 2 weeks | T-004, T-205 | Future Scope V3 | Один workflow доступен из нескольких каналов с единым session state |
| T-302 | Реализовать managed skill registry (versioning, trust metadata, updates) | P2 | 2 weeks | T-202, T-203 | Future Scope V3 | Есть каталог навыков, обновления версий и проверка доверия |
| T-303 | Добавить device-node execution (desktop/mobile nodes) | P2 | 2 weeks | T-204 | Future Scope V3 | Системные действия можно делегировать на привязанные device nodes |
| T-304 | Добавить org governance (tenancy, compliance templates, central audit) | P2 | 2 weeks | T-205 | Future Scope V3 | Мульти-tenant управление, политики хранения и централизованный аудит |
| T-305 | Добавить plugin marketplace с permission manifests и signing | P2 | 2 weeks | T-302 | Future Scope V3 | Плагины подписываются, права явно декларируются и валидируются |

## Critical Path for Challenge Submission

1. T-000 -> T-001 -> T-004 -> T-005 -> T-006
2. T-005 -> T-007 -> T-008 -> T-009
3. T-005 -> T-013 -> T-014
4. T-004 -> T-101 -> T-102 -> T-104 -> T-112
5. T-004 -> T-105 -> T-106 -> T-107
6. T-106 + T-104 -> T-109 -> T-110 -> T-111

## Current Quality Sprint Path

1. T-211 -> T-212 -> T-213 -> T-214 -> T-215 -> T-216 -> T-217 -> T-218

## Current Post-Feedback Execution Path

1. T-224 -> T-225 -> T-226 (P0 realtime reliability lane) [Completed]
2. T-227 (P1 capability expansion lane, OOB response lane) [Completed]
3. T-228 (P1 capability expansion lane, realtime function-calling bridge) [Completed]
4. T-229 (P1 capability expansion lane, realtime still-image lane) [Completed]
5. T-230 (P1 capability expansion lane, granular realtime output lane) [Completed]
6. T-231 (P1 capability expansion lane, structured conversation item lane) [Completed]
7. T-232 (P1 capability expansion lane, setup patch for realtime tools) [Completed]
8. T-233 (P1 capability expansion lane, conversation item audio attachment support) [Completed]
9. T-219/T-220/T-221/T-222 (parallel hardening lane) [Completed]
10. T-234 (P1 capability expansion lane, runtime live.setup override controls) [Completed]
11. T-235 (P1 capability expansion lane, ui_task grounding controls in demo frontend) [Completed]
12. T-236 (P1 capability expansion lane, gateway.error client-event correlation context) [Completed]
13. T-223 remains V2 spike only (no MVP transport change)

## Suggested Solo Execution (2-week MVP)

### Week 1 (Foundation + Live Agent)

1. Day 1: T-001 -> T-002 -> T-003
2. Day 2: T-000 -> T-004
3. Day 3: T-005 (start)
4. Day 4: T-005 (finish) -> T-006
5. Day 5: T-007 -> T-008
6. Day 6: T-009 -> T-013 -> T-014

### Week 2 (Story + UI + Demo)

1. Day 7: T-101 -> T-102 -> T-104
2. Day 8: T-105 (start) + T-112
3. Day 9: T-105 (finish) -> T-106
4. Day 10: T-107 -> T-109
5. Day 11: T-110 -> T-111
6. Day 12-14: stabilization buffer + optional T-103/T-108

### Solo Rules

1. WIP limit: only one major task in progress at a time.
2. Before new task: close previous task with smoke test + short runbook note.
3. Hard stop criteria for demo readiness: T-000..T-009 + T-013 + T-014 + T-015 + T-016 + T-017 + T-018 + T-019 + T-101 + T-102 + T-104 + T-105 + T-106 + T-107 + T-109 + T-110 + T-111 + T-112.



