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
| T-000 | Реализовать Minimal Demo Frontend (WebSocket + mic capture/playback + transcript + KPI panel) | P0 | 1 day | T-001 | R1, R3, R14 | Есть рабочая web-страница демо: соединение с gateway, захват/проигрывание аудио, видимый transcript и KPI/constraint panel |
| T-001 | Инициализировать сервисы проекта (API gateway, agent runtime, frontend shell) | P0 | 1 day | None | R0, R10, R11 | Запускаются локально и в cloud окружении, есть health endpoints |
| T-002 | Настроить GCP baseline (Project/IAM/Secrets/Service Accounts) | P0 | 0.5 day | T-001 | R11, R13 | Все сервисы аутентифицируются через IAM, секреты вынесены в Secret Manager/env |
| T-003 | Поднять Firestore схемы: sessions, events, negotiation_logs, assets | P0 | 0.5 day | T-002 | R1, R3, R4, R11, R16 | CRUD проходит, индексы созданы, TTL/retention правила заданы |
| T-004 | Реализовать ADK orchestration skeleton (agent registry + routing) | P0 | 1 day | T-001 | R0, R10, R16 | Live_Agent, Storyteller, UI_Navigator зарегистрированы и доступны через router |
| T-005 | Реализовать Live API streaming gateway (stateful WebSocket + setup/audio/turn protocol) | P0 | 2.5 day | T-002, T-004 | R1, R12 | Есть setup message с model profile, PCM framing/chunking, turn assembly, interruption propagation и устойчивый reconnect |
| T-006 | Добавить native interruption handling (`interrupted` events) | P0 | 0.5 day | T-005 | R1, R12 | Воспроизведение останавливается на прерывании, есть интеграционные тесты |
| T-007 | Реализовать базовый live translation mode | P0 | 0.5 day | T-005 | R2 | Автоопределение языка и перевод на целевой язык работают в live-сессии |
| T-008 | Реализовать negotiation mode с constraint-policy и audit logging | P0 | 1 day | T-003, T-004 | R3 | Предложения и контрпредложения логируются в Firestore, финал требует user confirm |
| T-009 | Включить минимальный observability слой (logging/metrics/alerts) | P0 | 0.5 day | T-001, T-002 | R15 | Есть p50/p95 latency, error rate и алерты на SLA breach |
| T-010 | Добавить единый реестр активных задач и realtime-прогресс событий | P1 | 0.5 day | T-004, T-005 | R10, R12, R14, R15 | Для долгих операций выдается taskId, есть `/tasks/active`, прогресс стримится в UI, финальный статус сохраняется в Firestore |
| T-011 | Реализовать lifecycle endpoints рантайма (status, warmup, drain, health, version) | P1 | 0.5 day | T-001, T-002 | R10, R11, R14, R15 | Операционные endpoints (`/status`, `/warmup`, `/drain`, `/healthz`, `/version`) доступны для gateway/api/orchestrator; drain-mode блокирует новые бизнес-запросы; runtime profile/version фиксируются в ответах |
| T-012 | Ввести границу capability-адаптеров (live, reasoning, tts, image, video, computer_use) | P1 | 1 day | T-004 | R0, R10, R11 | Бизнес-логика использует единый internal interface, Gemini/Vertex adapters заданы по умолчанию |
| T-013 | Усилить remote execution split и session/run binding между FE/Gateway/Orchestrator | P0 | 0.5 day | T-005 | R10, R12, R13, R14 | UI получает явные state transitions, каждое событие несет userId/sessionId/runId |
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
| Defer to M3 (P1) | T-012.* | Capability adapter layer | Полезно, но не blocker для demo |
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
| T-201 | Добавить profile-aware model failover (cooldowns, billing disable windows) | P1 | 1 week | T-005, T-009 | R10, R12, R15 | При rate-limit/billing model route переключается автоматически и прозрачно |
| T-202 | Добавить skills runtime (workspace/bundled/managed) и skill precedence | P1 | 1 week | T-004 | R10, R16 | Навыки загружаются с управляемыми приоритетами и конфиг-гейтингом |
| T-203 | Добавить skill security scanner и install-time trust gates | P1 | 0.5 week | T-202 | R13, R15 | Третьи навыки проходят scan/checklist до активации |
| T-204 | Реализовать sandbox policy modes для non-main/high-risk sessions | P1 | 1 week | T-106 | R13, R16 | Есть режимы `off/non-main/all`, документированные ограничения и исключения |
| T-205 | Расширить execution traces и audit dashboard | P1 | 0.5 week | T-009, T-109 | R15, R16 | Видны end-to-end traces: agent decisions, tools, screenshots, approvals |
| T-206 | Добавить performance/load test suite для live voice + UI navigation | P1 | 0.5 week | T-005, T-106 | R1, R6, R12, R15 | Автоматизированный профиль нагрузки с отчётом p95 latency и error budget |
| T-207 | Вынести долгие Veo/Imagen jobs в dedicated workers с quota-aware scheduling | P1 | 1 week | T-103, T-010 | R4, R10, R15 | Медиа-джобы выполняются отдельными воркерами, есть retry budget и видимость очередей |
| T-208 | Добавить детерминированный кэш для story assets/prompt variants и policy invalidation | P1 | 0.5 week | T-102, T-103, T-207 | R4, R5, R15 | Повторные запросы дают cache-hit, при смене model/version кэш инвалидируется консистентно |
| T-209 | Добавить local-first dev profile (non-production) для офлайн-итераций | P1 | 0.5 week | T-011, T-014 | R10, R14 | Отдельный dev profile существует, отключен policy в prod/staging и не влияет на challenge baseline |
| T-210 | Собрать operator console (active tasks, approval queue, health summary, cancel/retry/failover) | P1 | 0.5 week | T-205, T-010, T-011 | R10, R13, R15 | Оператор видит активные процессы и может выполнять recovery-действия с полным audit trail |

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
| T-210.4 | T-210 | Добавить audit trail для операторских действий и E2E тесты runbook-сценариев | 3h | T-210.2, T-210.3 | Каждое действие логируется, E2E сценарии восстановления проходят |

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



