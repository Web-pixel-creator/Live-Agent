# Requirements Document

## Introduction

Система "Агенты нового поколения" предназначена для создания трёх классов мультимодальных агентов для Live Agent Challenge:

- **Live Agent**: живое общение в реальном времени с возможностью прерываний, перевода на лету и переговоров.
- **Creative Storyteller**: интерактивный сторителлинг, объединяющий текст, аудио, видео и изображения.
- **UI Navigator**: агенты, понимающие экран и выполняющие действия за пользователя.

Система должна использовать современные модели Gemini и минимум один сервис Google Cloud, с приоритетом на production-ready архитектуру (ADK + Live API + Vertex AI / Cloud Run + Firestore).

## Glossary

- **System**: Платформа "Агенты нового поколения".
- **Live_Agent**: Агент для real-time диалога с голосом/видео, прерываниями и переводом.
- **Creative_Storyteller**: Агент для генерации и проигрывания интерактивного мультимодального контента.
- **UI_Navigator**: Агент для понимания интерфейса и выполнения действий в UI.
- **ADK**: Agent Development Kit для оркестрации агентов и инструментов (Python/TypeScript).
- **Live_API**: Multimodal Live API (Gemini API / Vertex AI) с двунаправленным WebSocket streaming.
- **Gemini_3_Flash**: Быстрая модель Gemini 3 для низкой задержки и online reasoning.
- **Gemini_3_Pro**: Модель Gemini 3 для сложного reasoning и планирования.
- **Gemini_Live_Model**: Модель семейства Gemini Live для real-time audio/video с native interruptions.
- **Gemini_TTS**: Нативный controllable TTS в Gemini.
- **Computer_Use_Tool**: Инструмент Gemini для восприятия скриншота и выдачи действий (click/type/scroll).
- **Imagen_4**: Модель генерации изображений.
- **Veo_3_1**: Модель генерации видео (с поддержкой аудио в соответствующих режимах).
- **Vertex_AI_Agent_Engine**: Managed runtime для ADK-агентов.
- **Agent_Engine_Sessions**: Persistent state и session context в Agent Engine.
- **Memory_Bank**: Долговременная память агентов в Agent Engine / Firestore.
- **Cloud_Run**: Serverless runtime для контейнеров.
- **Firestore**: NoSQL хранилище состояния, истории и логов.
- **Audio_Stream**: Поток аудиоданных в реальном времени.
- **Video_Stream**: Поток видеоданных в реальном времени.

## Requirements

### Requirement 0: Core Technology Stack

**User Story:** Как разработчик, я хочу использовать актуальный стек Google AI и Google Cloud, чтобы решение было современным, масштабируемым и соответствовало условиям челленджа.

#### Acceptance Criteria

1. THE System SHALL use ADK as the primary framework for agent orchestration, tools, and workflows.
2. THE System SHALL use Live_API for all real-time voice/video interactions.
3. THE System SHALL use `gemini-live-2.5-flash-native-audio` (Vertex AI) or `gemini-2.5-flash-native-audio-preview-12-2025` (Gemini API) for real-time audio turns, and `gemini-3-flash` or `gemini-3-pro` for non-live reasoning tasks.
4. THE System SHALL be deployable on Vertex_AI_Agent_Engine or Cloud_Run with ADK runtime.
5. THE System SHALL use at least one Google Cloud service, with recommended baseline: Vertex AI, Firestore, Cloud Run.
6. THE System SHALL pin model IDs and API versions in configuration to ensure reproducibility.
7. THE System SHALL support both Gemini API and Vertex AI endpoints via environment configuration.

### Requirement 1: Live Agent - Real-Time Communication

**User Story:** Как пользователь, я хочу говорить с агентом в живом режиме, чтобы получать естественный диалог с возможностью перебивать.

#### Acceptance Criteria

1. THE Live_Agent SHALL accept Audio_Stream input and optional Video_Stream input.
2. THE Live_Agent SHALL use stateful bidirectional Live_API streaming over WebSocket with a Gemini Live profile (recommended: `gemini-live-2.5-flash-native-audio` on Vertex AI).
3. THE Live_Agent SHALL handle user interruptions natively via Live_API interruption events.
4. THE Live_Agent SHALL stop ongoing speech playback immediately when interruption is detected.
5. THE Live_Agent SHALL target end-to-end voice round-trip latency of <= 1.2s and SHALL keep p95 <= 1.8s under normal network conditions.
6. THE Live_Agent SHALL maintain at least 50 turns of active context per session.
7. THE Live_Agent SHALL preserve speaking style and emotional tone in responses when supported by the selected model.
8. THE Live_Agent SHALL persist session metadata and conversation history in Firestore or Agent_Engine_Sessions.

### Requirement 2: Live Agent - Real-Time Translation

**User Story:** Как пользователь, я хочу, чтобы агент переводил речь на лету и сохранял интонацию собеседника.

#### Acceptance Criteria

1. WHERE translation mode is enabled, THE Live_Agent SHALL detect source language automatically.
2. WHERE translation mode is enabled, THE Live_Agent SHALL produce translated text and voice in the target language.
3. THE Live_Agent SHALL preserve tone and intent of the speaker in translated output.
4. THE Live_Agent SHALL support all real-time voice languages available in the selected Gemini_Live_Model profile and SHALL support at least 20 languages in production configuration.
5. WHERE target language is unsupported for native voice output, THE Live_Agent SHALL fall back to text translation and optional secondary TTS path.
6. THE Live_Agent SHALL allow per-session language pair configuration.

### Requirement 3: Live Agent - Negotiation Capabilities

**User Story:** Как пользователь, я хочу делегировать агенту переговоры в рамках заданных ограничений.

#### Acceptance Criteria

1. WHERE negotiation mode is enabled, THE Live_Agent SHALL accept explicit goals, constraints, and forbidden actions.
2. THE Live_Agent SHALL use Gemini_3_Pro or Gemini_3_Flash to evaluate offers and generate counter-offers.
3. THE Live_Agent SHALL explain negotiation rationale in a structured format for user audit.
4. THE Live_Agent SHALL log all negotiation steps, offers, and decisions to Firestore.
5. WHEN a final agreement is reached, THE Live_Agent SHALL require explicit user confirmation before committing.

### Requirement 4: Creative Storyteller - Multimodal Content Generation

**User Story:** Как создатель контента, я хочу генерировать интерактивные истории с текстом, голосом, изображениями и видео.

#### Acceptance Criteria

1. THE Creative_Storyteller SHALL accept a story prompt and audience/style parameters.
2. THE Story_Generator SHALL use Gemini_3_Pro for story planning and arc consistency.
3. THE Story_Generator SHALL use Gemini_3_Flash for fast branch continuation during interaction.
4. THE Story_Generator SHALL generate images using Imagen_4 APIs.
5. WHERE video is requested, THE Story_Generator SHALL generate video scenes using Veo_3_1 APIs.
6. THE Story_Generator SHALL generate narration with Gemini_TTS and style controls.
7. THE Creative_Storyteller SHALL produce a synchronized Multimodal_Content stream (text + audio + image/video).
8. THE Creative_Storyteller SHALL store generated assets metadata and references in Firestore.

### Requirement 5: Creative Storyteller - Interactive Story Flow

**User Story:** Как пользователь, я хочу влиять на развитие истории голосом или выбором вариантов.

#### Acceptance Criteria

1. THE Creative_Storyteller SHALL present decision points during playback.
2. WHEN a user choice is received, THE Story_Generator SHALL generate the next branch with low-latency continuation.
3. THE Creative_Storyteller SHALL persist story state across sessions using Agent_Engine_Sessions or Firestore.
4. THE Creative_Storyteller SHALL accept voice commands for navigation and branch selection.
5. THE Creative_Storyteller SHALL keep text, narration, and visual timeline synchronized.
6. THE Story_Generator SHALL use deterministic cache keys for repeated plan/branch/asset variants (prompt + model + locale + style context).
7. THE System SHALL invalidate story cache when model/version fingerprint changes or when a manual purge token is rotated.
8. THE System SHALL expose story cache observability and purge controls for operators (`/story/cache`, `/story/cache/purge`).

### Requirement 6: UI Navigator - Computer Use

**User Story:** Как пользователь, я хочу, чтобы агент управлял интерфейсом как человек: видел экран, нажимал, вводил текст и прокручивал.

#### Acceptance Criteria

1. THE UI_Navigator SHALL use Computer_Use_Tool with a supported model profile (for example: `gemini-3-flash-preview`, `gemini-3-pro-preview`, or `gemini-2.5-computer-use-preview-10-2025`).
2. WHEN a screen snapshot is captured, THE UI_Navigator SHALL send screenshot context and task objective to the model.
3. THE model SHALL return an executable action sequence (click coordinates, typing, hotkeys, scroll).
4. THE Action_Executor SHALL execute actions through Playwright/Puppeteer for web flows or through approved native control adapters.
5. THE UI_Navigator SHALL capture a post-action screenshot and verify expected state in a self-correction loop.
6. THE UI_Navigator SHALL stop execution and request user confirmation for sensitive actions (payments, credential submission, destructive operations).

### Requirement 7: UI Navigator - Action Execution Reliability

**User Story:** Как пользователь, я хочу, чтобы агент надёжно выполнял команды и корректно обрабатывал ошибки.

#### Acceptance Criteria

1. THE UI_Navigator SHALL accept natural language commands and task goals.
2. THE UI_Navigator SHALL convert commands into a step-by-step action plan with preconditions.
3. THE Action_Executor SHALL support click, type, select, scroll, drag-and-drop, and keyboard actions.
4. WHEN an action fails, THE UI_Navigator SHALL retry with updated screen understanding before aborting.
5. THE UI_Navigator SHALL produce a human-readable execution trace with step status and screenshots.
6. THE UI_Navigator SHALL persist traces and failure diagnostics in Firestore.

### Requirement 8: UI Navigator - Web Navigation

**User Story:** Как пользователь, я хочу делегировать агенту веб-навигацию, заполнение форм и сбор данных.

#### Acceptance Criteria

1. THE UI_Navigator SHALL accept URL and goal-oriented instructions.
2. THE UI_Navigator SHALL navigate web pages and interact with forms to complete user tasks.
3. THE UI_Navigator SHALL extract structured data from visited pages when requested.
4. THE UI_Navigator SHALL handle authentication flows only with explicit user approval.
5. THE UI_Navigator SHALL respect website policies, including robots and anti-abuse controls.

### Requirement 9: UI Navigator - Visual Testing

**User Story:** Как QA-инженер, я хочу использовать агента для визуального тестирования UI и поиска регрессий.

#### Acceptance Criteria

1. WHERE visual testing mode is enabled, THE UI_Navigator SHALL execute scenario steps and capture baseline/actual screenshots.
2. THE UI_Navigator SHALL compare expected and actual states using model-based visual reasoning.
3. THE UI_Navigator SHALL detect layout, content, and interaction regressions.
4. THE UI_Navigator SHALL generate a structured report with findings, screenshots, and severity labels.
5. THE UI_Navigator SHALL store test artifacts and reports in Firestore.

### Requirement 10: Platform Infrastructure - Agent Orchestration and Deployment

**User Story:** Как разработчик платформы, я хочу управляемую инфраструктуру для деплоя и исполнения нескольких агентов.

#### Acceptance Criteria

1. THE System SHALL use ADK for tool registration, routing, and multi-agent orchestration.
2. THE System SHALL support deployment to Vertex_AI_Agent_Engine with autoscaling.
3. THE System SHALL support Cloud_Run deployment for custom runtimes and gateway services.
4. THE System SHALL support Agent_Engine_Sessions and Memory_Bank for persistent context.
5. THE System SHALL support environment-based promotion flows (dev, staging, production).
6. THE System SHALL define an internal capability adapter interface (`live`, `reasoning`, `tts`, `image`, `video`, `computer_use`) with Gemini/Vertex defaults and auditable profile metadata per run.
7. THE System SHALL support a `local-first` runtime profile for offline/non-production development iterations.
8. THE System SHALL block `local-first` startup in staging/production environments and SHALL expose applied runtime profile metadata in runtime endpoints.

### Requirement 11: Platform Infrastructure - Google Cloud Services

**User Story:** Как разработчик платформы, я хочу использовать сервисы Google Cloud для масштабируемости и надёжности.

#### Acceptance Criteria

1. THE System SHALL run at least one core component on Google Cloud.
2. THE System SHOULD use Vertex AI for model serving and agent runtime integration.
3. THE System SHOULD use Firestore for state, history, and audit logs.
4. THE System SHOULD use Cloud_Run for API gateway and streaming/session services.
5. THE System SHALL use IAM-based authentication and authorization for service-to-service access.
6. THE System SHALL use Cloud Logging and Cloud Monitoring for runtime visibility.

### Requirement 12: Platform Infrastructure - Real-Time Data Processing

**User Story:** Как разработчик платформы, я хочу обрабатывать аудио/видео поток в реальном времени с минимальной задержкой.

#### Acceptance Criteria

1. THE System SHALL establish stateful WebSocket connections for Live_API streaming.
2. THE System SHALL support audio input streams in 16kHz PCM format and maintain continuous turn-taking.
3. THE System SHALL support low-frequency video frame streaming (recommended baseline: 1 FPS JPEG frames) for real-time scene context when enabled.
4. THE System SHALL detect connection drops and reconnect automatically within 5 seconds.
5. THE System SHALL apply bounded buffering and drop stale frames/chunks to preserve real-time behavior.
6. THE System SHALL react to Live_API `interrupted` events without waiting for full turn completion.

### Requirement 13: Security and Privacy

**User Story:** Как пользователь, я хочу, чтобы мои данные и действия агента были защищены.

#### Acceptance Criteria

1. THE System SHALL encrypt all in-transit traffic using TLS 1.3 or higher.
2. THE System SHALL encrypt sensitive data at rest in managed Google Cloud storage services.
3. THE System SHALL authenticate users before agent access is granted.
4. THE System SHALL enforce role-based permissions for operational and admin actions.
5. WHERE user requests account data deletion, THE System SHALL delete associated records within defined SLA.
6. THE System SHALL keep raw audio/video retention minimized and policy-controlled.
7. THE System SHALL keep a tamper-evident audit trail for sensitive actions.

### Requirement 14: API and Integration

**User Story:** Как разработчик продукта, я хочу интегрировать агентную платформу через стабильный API.

#### Acceptance Criteria

1. THE System SHALL provide REST APIs for session, task, and content management.
2. THE System SHALL provide WebSocket APIs for real-time agent communication.
3. THE System SHALL publish API schemas and examples.
4. THE System SHALL version APIs and maintain backward compatibility policy.
5. THE System SHALL enforce authentication, authorization, and rate limiting on APIs.
6. THE System SHALL return consistent error formats with trace identifiers.
7. THE System SHALL propagate correlation context (`userId`, `sessionId`, `runId`) across FE/Gateway/Orchestrator events and reject websocket requests with binding mismatches.

### Requirement 15: Monitoring and Observability

**User Story:** Как оператор системы, я хочу наблюдать качество работы агентов и быстро реагировать на инциденты.

#### Acceptance Criteria

1. THE System SHALL log all agent interactions with session IDs and timestamps.
2. THE System SHALL track latency metrics (p50/p95) per modality and per agent type.
3. THE System SHALL track tool execution metrics, including Computer_Use success/failure rates.
4. THE System SHALL track model/API error rates and quota failures.
5. THE System SHALL trigger alerts on SLA breaches and elevated error rates.
6. THE System SHALL provide real-time dashboards for operations and quality monitoring.
7. THE System SHALL retain logs and metrics according to compliance policy.
8. THE System SHALL enforce an automated CI policy check on demo KPI artifacts (`summary.json`) and fail release pipelines on regression of judge-critical metrics.
9. THE System SHALL publish a public, machine-readable demo KPI badge endpoint (`badge.json`, e.g. via `gh-pages`) for external status embedding and reviewer visibility.
10. THE repository SHALL provide an operator runbook or scripts to configure badge endpoint publication and validate endpoint health after deployment.
11. THE repository SHALL provide scripted local release verification and repository publish workflows to reduce manual release errors.

### Requirement 16: Multi-Agent Collaboration

**User Story:** Как пользователь, я хочу, чтобы специализированные агенты работали совместно и делегировали задачи друг другу.

#### Acceptance Criteria

1. THE System SHALL support multi-agent workflows orchestrated by ADK.
2. THE Live_Agent SHALL be able to delegate UI tasks to UI_Navigator and storytelling tasks to Creative_Storyteller.
3. THE System SHALL maintain shared context across collaborating agents using Sessions/Memory_Bank.
4. THE System SHALL persist cross-agent events, decisions, and tool calls in Firestore.
5. THE System SHALL support human-in-the-loop approval gates for high-risk delegated actions.
6. THE System SHALL expose an end-to-end trace of delegated workflows for audit and debugging.

## Technology Mapping

| Category | Primary Components | Models | Google Cloud Services |
| --- | --- | --- | --- |
| Live Agent | ADK + Live_API + realtime gateway | Gemini_Live_Model + Gemini_3_Flash/Pro | Vertex AI, Cloud Run, Firestore |
| Creative Storyteller | ADK workflows + media pipeline | Gemini_3_Pro/Flash + Imagen_4 + Veo_3_1 + Gemini_TTS | Vertex AI, Firestore, Cloud Storage (optional) |
| UI Navigator | Computer_Use_Tool + Action_Executor + browser automation | Gemini-supported Computer Use profile + Gemini_3 reasoning | Cloud Run, Firestore, Vertex AI |
| Platform | Agent orchestration, session management, monitoring | Configurable per workload | Vertex_AI_Agent_Engine, Cloud Monitoring, Cloud Logging |

## Recommended Model Profiles (as of 2026-02-19)

| Workload | Recommended Model |
| --- | --- |
| Real-time voice/video | `gemini-live-2.5-flash-native-audio` (Vertex AI) or `gemini-2.5-flash-native-audio-preview-12-2025` (Gemini API) |
| Fast reasoning and branch generation | `gemini-3-flash` |
| Deep reasoning and planning | `gemini-3-pro` |
| Computer Use | `gemini-3-flash-preview` or `gemini-3-pro-preview` (fallback: `gemini-2.5-computer-use-preview-10-2025`) |
| Image generation | Imagen 4 family (latest stable endpoint in target region) |
| Video generation | Veo 3.1 family (latest stable endpoint in target region) |
| Speech synthesis | Gemini native TTS profile selected per locale/style |

## Future Scope (V2/V3)

Этот раздел фиксирует расширения, которые **не обязательны для MVP/челленджа**, но рекомендуются для развития продукта после первичного релиза.

### V2: Product Hardening and Reliability

1. THE System SHOULD implement provider/profile-aware model failover with cooldowns and billing-aware disable windows.
2. THE System SHOULD add a unified WebSocket control plane for clients, tools, and agent lifecycle events.
3. THE System SHOULD implement advanced sandbox policy modes for non-main sessions and high-risk tool calls.
4. THE System SHOULD add skill trust levels, mandatory skill scanning, and install-time security gates for third-party skills.
5. THE System SHOULD provide richer execution traces, including per-step screenshots and structured failure diagnostics for UI automation.
6. THE System SHOULD add policy-driven approval workflows for sensitive delegated actions.

### V3: Ecosystem and Platform Expansion

1. THE System MAY support multi-channel communication surfaces (for example, Telegram, Slack, Discord, and WebChat).
2. THE System MAY provide a managed skill registry with versioning, discovery, install/update workflows, and trust metadata.
3. THE System MAY support device nodes (desktop/mobile) for distributed execution of camera/screen/system actions.
4. THE System MAY add organization-level governance features, including tenancy, compliance templates, and centralized audit dashboards.
5. THE System MAY add plugin marketplace capabilities with signed extensions and permission manifests.
6. THE System MAY add long-horizon automation flows that combine Live_Agent, UI_Navigator, and Creative_Storyteller across scheduled jobs.

### Deferred by Design (Not a Baseline)

1. Provider-specific Anthropic-first defaults are explicitly out of baseline scope for this project.
2. Replacing ADK orchestration with non-ADK runtime cores is out of baseline scope.
3. Full monolithic multi-channel gateway architecture is deferred unless justified by product goals and team capacity.
