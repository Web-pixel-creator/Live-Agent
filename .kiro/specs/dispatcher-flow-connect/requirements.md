# Requirements Document

## Introduction

Этот спек — узкий продуктовый срез поверх стабильного воркбенча диспетчера
(коммит `4ea59d35 fix: stabilize dispatcher workbench layout`). Слой layout
больше не меняется в этом срезе. Цель — связать стабильный диспетчер с
существующими продуктовыми поверхностями `7-minute launch path`,
`launch packet` и `outreach execution pack` так, чтобы новый оператор сразу
видел путь `request -> decision -> approval -> handoff/export` без чтения
документации.

Этот спек намеренно уже, чем родительский `multimodal-agents`. Родительский
спек остаётся challenge-grade платформенным документом и в рамках этого среза
не редактируется. Все действия в новом потоке остаются ручными и одобряются
человеком — никакой автономной отправки клиенту, диспетчеризации мастеру,
записи в CRM, синхронизации календаря, биллинга или активации канала.

Этот спек — downstream-надстройка, а не замена. Source-of-truth документы,
которые должны оставаться авторитетными:

1. `AGENTS.md`
2. `docs/current-local-services-agent-handoff.md`
3. `docs/local-services-agent-handoff.md`
4. `docs/local-services-action-desk-spec.md`
5. `docs/local-services-developer-map.md`
6. `docs/product-master-plan.md`

Технические поверхности, против которых работает срез (упоминаются как
ссылки, не редизайнятся в этом срезе):

- Frontend: `apps/demo-frontend/app-shell/src/components/workspace/LiveDesk.tsx`,
  `apps/demo-frontend/app-shell/src/lib/local-services-workspace-adapter.ts`,
  `apps/demo-frontend/app-shell/src/lib/local-services-scenarios.ts`,
  `apps/demo-frontend/public/app-shell/index.js`,
  `apps/demo-frontend/public/app-shell/style.css`.
- Backend: `apps/api-backend/src/local-services-workspace.ts`, смонтирован из
  `apps/api-backend/src/index.ts`. Маршруты:
  `/v1/local-services/workspace`, `/v1/local-services/cases`,
  `/v1/local-services/cases/:ref/decision`,
  `/v1/local-services/setup/events`, `/v1/local-services/pilot/export`.
  Ключ хранения: `liveDesk:localServicesPilotWorkspace:v1`.
- Alignment-тест: `tests/unit/demo-frontend-app-shell-runtime-alignment.test.ts`.

## Glossary

- **Dispatcher_Workspace**: основной воркбенч диспетчера, реализованный в
  `apps/demo-frontend/app-shell/src/components/workspace/LiveDesk.tsx` и
  доступный на маршруте `/app?demo=local-services-dispatch&service=...`.
- **Default_Demo_Route**: маршрут
  `/app?demo=local-services-dispatch&service=ac-repair-dispatch`,
  используемый как дефолтное состояние первого открытия оператором.
- **Operator**: человек, авторизованный просматривать заявки, принимать
  решения и одобрять действия в `Dispatcher_Workspace`.
- **Compact_Queue**: левая колонка очереди заявок, помеченная маркером
  `Main dispatcher compact queue` и `Dispatcher compact request queue`.
- **Decision_Rail**: правая колонка решения, помеченная маркерами
  `Main dispatcher full-height decision rail` и
  `Selected request decision rail`.
- **Promotion_CTA**: единственная видимая точка перехода из
  `Dispatcher_Workspace` в продуктовый поток
  `Launch_Path_7min` -> `Launch_Packet` -> `Outreach_Execution_Pack`.
- **Launch_Path_7min**: продуктовая поверхность `7-minute launch path`,
  открываемая через query-параметры `path=7min&view=requests` и
  `setup=7min&view=setup`.
- **Launch_Packet**: продуктовая поверхность `launch packet`, открываемая
  через `path=7min&view=requests&packet=launch` и помеченная маркерами
  `Launch packet bridge` и `Launch packet readiness card`.
- **Outreach_Execution_Pack**: продуктовая поверхность
  `outreach execution pack`, открываемая через действие с маркером
  `Open outreach execution pack`.
- **Pilot_Export_Drawer**: ящик экспорта пилота, помеченный маркером
  `Pilot workspace export drawer`.
- **Frontend_Marker**: строковая метка во фронтенде, по которой
  `Alignment_Test` ищет наличие соответствующих UI-узлов.
- **Alignment_Test**: тест
  `tests/unit/demo-frontend-app-shell-runtime-alignment.test.ts`.
- **Local_Stack**: набор локальных сервисов с health-эндпоинтами
  `http://localhost:3000/healthz`, `http://localhost:8080/healthz`,
  `http://localhost:8081/healthz`, `http://localhost:8082/healthz`.
- **P0_Vertical**: одна из четырёх P0-вертикалей: ремонт AC/HVAC, аварийная
  сантехника, клининг (расчёт и бронирование), визит замерщика.
- **Manual_Approval**: явное действие `Operator`, подтверждающее операцию
  перед любым внешним эффектом.
- **Release_KPI_Gate**: существующая release-проверка из
  `npm run verify:release`, включая `assistantActivityLifecycleValidated`,
  `liveContextCompactionValidated`, `operatorStartupDiagnosticsValidated` и
  KPI телеметрии разделения.

## Requirements

### Requirement 1: Видимость потока на дефолтном маршруте

**User Story:** Как оператор, открывающий продукт впервые, я хочу сразу
видеть очередь заявок, рейл решения и путь к одобрению/экспорту, чтобы
понимать продуктовый поток без чтения документации.

#### Acceptance Criteria

1. WHEN `Operator` открывает `Default_Demo_Route` в окне с шириной не менее 1600px и высотой не менее 900px, THE `Dispatcher_Workspace` SHALL отрисовать `Compact_Queue` и `Decision_Rail` полностью в зоне первого экрана (above-the-fold) без вертикальной и горизонтальной прокрутки, при этом `Compact_Queue` SHALL содержать не менее 3 видимых элементов заявок.
2. WHEN `Operator` открывает `Default_Demo_Route` в окне с шириной не менее 1600px и высотой не менее 900px, THE `Dispatcher_Workspace` SHALL отрисовать `Promotion_CTA` в зоне первого экрана как видимый интерактивный элемент без открытия дополнительного ящика, drawer, модального окна, всплывающей подсказки или раскрытия аккордеона.
3. WHEN `Operator` открывает `Default_Demo_Route` на стенде с прогретым `Local_Stack`, THE `Dispatcher_Workspace` SHALL завершить отрисовку `Compact_Queue`, `Decision_Rail` и `Promotion_CTA` в течение 5000 миллисекунд от момента навигации, измеряемых до достижения состояния, в котором все три элемента видимы и интерактивны.
4. THE `Dispatcher_Workspace` SHALL отображать последовательность визуальных шагов `request -> decision -> approval -> handoff/export` как единственный доминирующий путь на `Default_Demo_Route`, без альтернативных навигационных путей в зоне первого экрана, ведущих в обход этой последовательности.
5. IF `Operator` открывает `Default_Demo_Route` в окне с шириной менее 1600px или высотой менее 900px, THEN THE `Dispatcher_Workspace` SHALL сохранить порядок и видимость элементов `Compact_Queue`, `Decision_Rail` и `Promotion_CTA` в указанной последовательности, допуская вертикальную прокрутку для доступа к `Promotion_CTA`.
6. IF `Local_Stack` не прогрет или недоступен при открытии `Default_Demo_Route`, THEN THE `Dispatcher_Workspace` SHALL отобразить состояние загрузки или сообщение об ошибке, идентифицирующее недоступность стенда, с сохранением структуры последовательности `request -> decision -> approval -> handoff/export`.

### Requirement 2: Единственный доминирующий promotion-путь

**User Story:** Как оператор, я хочу видеть одну очевидную кнопку перехода
в продуктовый поток `7-minute launch path -> launch packet -> outreach
execution pack`, чтобы не выбирать между конкурирующими CTA.

#### Acceptance Criteria

1. THE `Dispatcher_Workspace` SHALL содержать ровно один видимый `Promotion_CTA`, ведущий в `Launch_Path_7min`, при этом любой иной элемент с маркером `Promotion_CTA` или ссылкой на `Launch_Path_7min` SHALL отсутствовать в DOM текущего экрана.
2. WHEN `Operator` активирует `Promotion_CTA`, THE `Dispatcher_Workspace` SHALL открыть `Launch_Path_7min` через query-состояние `path=7min&view=requests` в течение не более 1000 миллисекунд от момента активации.
3. WHILE `Operator` находится внутри `Launch_Path_7min`, THE `Dispatcher_Workspace` SHALL предоставить ровно один доминирующий переход в `Launch_Packet` через query-состояние `path=7min&view=requests&packet=launch`, и любые альтернативные переходы к `Launch_Packet` SHALL отсутствовать на текущем экране.
4. WHILE `Operator` находится внутри `Launch_Packet`, THE `Dispatcher_Workspace` SHALL предоставить ровно один доминирующий переход в `Outreach_Execution_Pack` через действие с маркером `Open outreach execution pack`, и любые альтернативные переходы к `Outreach_Execution_Pack` SHALL отсутствовать на текущем экране.
5. THE `Dispatcher_Workspace` SHALL отличать `Promotion_CTA` от соседних действий одновременно по трём измеримым признакам: визуальный вес (площадь кликабельной зоны не менее чем в 1.5 раза больше любого соседнего действия в том же контейнере), позиция (первое действие в порядке чтения слева направо и сверху вниз внутри контейнера) и копирайт (текст совпадает с маркером `Promotion_CTA`), при этом новые CTA вне пути `Launch_Path_7min -> Launch_Packet -> Outreach_Execution_Pack` SHALL не вводиться.
6. WHERE `Operator` уже активировал `Promotion_CTA` в текущей сессии, THE `Dispatcher_Workspace` SHALL отражать прогресс по шагам пути `Launch_Path_7min -> Launch_Packet -> Outreach_Execution_Pack` в зоне `Launch packet readiness card` с обновлением в течение не более 1000 миллисекунд после смены текущего шага.
7. IF query-состояние пути `Launch_Path_7min` или `Launch_Packet` отсутствует, повреждено либо содержит неподдерживаемые значения параметров `path`, `view` или `packet`, THEN THE `Dispatcher_Workspace` SHALL вернуть `Operator` к `Promotion_CTA` и показать сообщение об ошибке навигации, сохранив ранее зафиксированный прогресс по шагам пути.
8. IF переход к `Launch_Path_7min`, `Launch_Packet` или `Outreach_Execution_Pack` не завершается успешно в течение 5000 миллисекунд от момента активации, THEN THE `Dispatcher_Workspace` SHALL отменить переход, оставить `Operator` на исходном экране и показать сообщение об ошибке с возможностью повторной активации `Promotion_CTA`.

### Requirement 3: Инвариант ручного одобрения

**User Story:** Как владелец продукта, я хочу, чтобы каждое действие в
новом потоке оставалось ручным и одобренным оператором, чтобы пилот
сохранял контракт `manual-only` и не отправлял ничего автономно.

#### Acceptance Criteria

1. THE `Dispatcher_Workspace` SHALL требовать действительный `Manual_Approval`, привязанный к текущей версии данных заявки, перед любой операцией, имеющей внешний эффект, включая отправку клиенту, передачу мастеру, запись в CRM, синхронизацию аналитики, биллинг и активацию канала.
2. IF `Operator` не выполнил `Manual_Approval` для текущей заявки или действующий `Manual_Approval` стал недействительным, THEN THE `Dispatcher_Workspace` SHALL блокировать переходы, имеющие внешний эффект, и отображать в `Decision_Rail` причину блокировки, содержащую идентификатор заблокированного действия, статус `Manual_Approval` и шаг, требуемый от `Operator` для разблокировки.
3. THE `Dispatcher_Workspace` SHALL не выполнять автономную отправку клиенту, диспетчеризацию мастеру, бронирование, запись в CRM, синхронизацию аналитики, биллинг или активацию канала ни в одной точке потока `request -> decision -> approval -> handoff/export`, включая фоновые задачи, повторные попытки и таймерные переходы.
4. WHEN `Operator` инициирует переход в `Outreach_Execution_Pack` или `Pilot_Export_Drawer`, THE `Dispatcher_Workspace` SHALL отображать подтверждающее сообщение, содержащее название следующей операции, указание, что внешнее исполнение остаётся ручным, и явный шаг, который `Operator` должен выполнить вручную для запуска внешнего канала.
5. IF данные заявки изменились после получения `Manual_Approval`, THEN THE `Dispatcher_Workspace` SHALL аннулировать ранее полученный `Manual_Approval`, блокировать переходы с внешним эффектом и требовать повторного `Manual_Approval` перед любой операцией, имеющей внешний эффект.

### Requirement 4: Скоуп P0-вертикалей

**User Story:** Как владелец продукта, я хочу, чтобы новый поток покрывал
только P0-вертикали Ташкентского диспетчера, чтобы срез не расходился с
текущим коммерческим клином.

#### Acceptance Criteria

1. WHEN `Operator` открывает `Dispatcher_Workspace` с query-параметром `service`, значение которого принадлежит фиксированному набору из ровно четырёх допустимых значений {`ac-repair-dispatch`, `plumbing-emergency`, `cleaning-quote-booking`, `measurement-visit-booking`} (сравнение строгое, регистрозависимое, без ведущих/замыкающих пробелов, длина значения от 1 до 64 символов), THE `Dispatcher_Workspace` SHALL загрузить рабочее пространство соответствующей вертикали и отобразить её идентификатор в заголовке.
2. IF query-параметр `service` отсутствует, пуст, имеет длину более 64 символов или его значение не входит в набор {`ac-repair-dispatch`, `plumbing-emergency`, `cleaning-quote-booking`, `measurement-visit-booking`}, THEN THE `Dispatcher_Workspace` SHALL отклонить запрошенную вертикаль, отобразить сообщение об ошибке с указанием недопустимого значения и выполнить переход к `Default_Demo_Route` без сохранения отклонённого значения.
3. THE `Dispatcher_Workspace` SHALL не предоставлять и не отображать в UI, навигации, выпадающих списках выбора вертикалей и обработчиках query-параметра `service` ни одной вертикали вне набора из четырёх P0-значений, в частности SHALL отклонять значения `electrical`, `commercial-construction-materials`, `restaurants`, `hotels`, `dentistry` так же, как любое другое неизвестное значение по критерию 2.
4. WHEN `Operator` открывает `Default_Demo_Route` без явно указанного query-параметра `service`, THE `Dispatcher_Workspace` SHALL инициализировать активную вертикаль значением `ac-repair-dispatch` в течение 2 секунд после завершения загрузки маршрута и отобразить её как состояние по умолчанию до первого пользовательского переключения.

### Requirement 5: Маркерная дисциплина

**User Story:** Как разработчик, я хочу, чтобы любое переименование
frontend-маркеров синхронизировалось с alignment-тестом, чтобы
регрессии IA ловились детерминированно.

#### Acceptance Criteria

1. THE `Dispatcher_Workspace` SHALL содержать в исходном коде frontend в неизменном виде ровно следующий перечень из 6 строк `Frontend_Marker`: `Main dispatcher compact queue`, `Main dispatcher full-height decision rail`, `Selected request decision rail`, `Open outreach execution pack`, `Launch packet bridge`, `Pilot workspace export drawer`, причём каждая строка SHALL присутствовать побайтово идентично указанной (с учётом регистра и пробелов) и SHALL рендериться в DOM `Dispatcher_Workspace` при стандартной загрузке маршрута.
2. IF любая из 6 строк `Frontend_Marker`, перечисленных в Acceptance Criteria 5.1, переименована, удалена или текстуально изменена в одном pull request, THEN THE `Alignment_Test` SHALL быть обновлён в том же pull request (в пределах того же commit-набора, до слияния) и SHALL завершаться с кодом возврата 0 при 100% прохождении всех своих утверждений в финальном CI-прогоне этого pull request.
3. WHEN в `Dispatcher_Workspace` добавляется новая строка `Frontend_Marker`, THE pull request SHALL в том же commit-наборе добавлять в `Alignment_Test` хотя бы одно утверждение, проверяющее наличие добавленного маркера в отрендеренном DOM `Dispatcher_Workspace` побайтово идентично исходному тексту маркера.
4. WHEN `Alignment_Test` выполняется, THE `Alignment_Test` SHALL для каждой из 6 строк `Frontend_Marker` из Acceptance Criteria 5.1 проверять её присутствие в отрендеренном DOM `Dispatcher_Workspace` и SHALL завершаться с ненулевым кодом возврата с сообщением, идентифицирующим конкретный отсутствующий или несовпадающий маркер, если хотя бы один маркер отсутствует, удалён или его текст отличается от ожидаемого.
5. IF pull request изменяет, удаляет или добавляет `Frontend_Marker` в `Dispatcher_Workspace` без синхронного обновления `Alignment_Test` в том же commit-наборе, либо обновлённый `Alignment_Test` завершается с ненулевым кодом, THEN THE CI pipeline SHALL помечать проверку как failed и SHALL блокировать слияние pull request до устранения рассинхронизации.

### Requirement 6: Сохранение layout-инвариантов

**User Story:** Как оператор, я хочу, чтобы недавно стабилизированный
layout диспетчера не регрессировал, чтобы стенд оставался читаемым.

#### Acceptance Criteria

1. WHILE ширина окна составляет от 1600px до 3840px включительно, THE `Dispatcher_Workspace` SHALL отображать `Compact_Queue` и `Decision_Rail` в двухколоночной раскладке без визуального наложения колонок и без горизонтальной прокрутки страницы.
2. WHILE ширина окна находится в диапазоне от 320px до 1599px включительно, THE `Dispatcher_Workspace` SHALL располагать `Decision_Rail` стеком ниже `Compact_Queue`, удерживая обе панели в пределах видимой области viewport без off-canvas-обрезания и без горизонтальной прокрутки страницы.
3. WHILE применена двухколоночная раскладка, THE `Decision_Rail` SHALL занимать ширину в диапазоне от 520px до 540px включительно.
4. THE `Dispatcher_Workspace` SHALL резервировать ширину полосы действий строки в диапазоне от 188px до 204px включительно для каждой строки `Compact_Queue`.
5. WHILE ширина окна составляет ровно 1280px, THE `Dispatcher_Workspace` SHALL удерживать суммарную ширину контента в пределах ширины viewport и не допускать появления горизонтальной полосы прокрутки страницы.
6. THE `Dispatcher_Workspace` SHALL удерживать каждую кнопку действий строки полностью внутри прямоугольных границ соответствующей строки `Compact_Queue` по горизонтали и по вертикали, без выхода за её края на любое количество пикселей.
7. IF ширина окна изменяется и пересекает порог 1600px, THEN THE `Dispatcher_Workspace` SHALL переключить раскладку между двухколоночной и стековой в течение не более 500мс, сохраняя видимость `Compact_Queue` и `Decision_Rail` без потери данных строк очереди.
8. IF ширина viewport не позволяет одновременно соблюсти ширину `Decision_Rail` от 520px до 540px и полосу действий от 188px до 204px в двухколоночной раскладке, THEN THE `Dispatcher_Workspace` SHALL переключиться на стековую раскладку, описанную в критерии 2.

### Requirement 7: Предусловие локального стенда для визуальной проверки

**User Story:** Как разработчик, я хочу не считать визуальную проверку
завершённой, пока локальный стенд не отвечает 200, чтобы избежать ложного
зелёного.

#### Acceptance Criteria

1. WHEN разработчик инициирует визуальную проверку среза, THE `Local_Stack` SHALL подтвердить, что каждый из эндпоинтов `http://localhost:3000/healthz`, `http://localhost:8080/healthz`, `http://localhost:8081/healthz` и `http://localhost:8082/healthz` отвечает HTTP-кодом ровно 200 в течение не более 5 секунд на каждый запрос до начала визуальной проверки этого среза.
2. IF любой из четырёх health-эндпоинтов, перечисленных в Acceptance Criteria 7.1, не возвращает HTTP 200 в течение 5 секунд, или возвращает любой иной HTTP-код, или соединение не устанавливается, THEN THE визуальная проверка этого среза SHALL считаться незавершённой и SHALL быть отмечена как `НЕ ЗАВЕРШЕНА` с указанием первого эндпоинта, не прошедшего проверку.
3. WHEN все четыре health-эндпоинта из Acceptance Criteria 7.1 возвращают HTTP 200 в пределах 5 секунд каждый, THE `Local_Stack` SHALL зафиксировать наблюдаемый признак готовности (HTTP-код 200 и URL каждого эндпоинта) до старта визуальной проверки.
4. IF проверка любого из четырёх health-эндпоинтов из Acceptance Criteria 7.1 не выполнена до начала визуальной проверки, THEN THE визуальная проверка этого среза SHALL не запускаться и SHALL быть прервана с признаком незавершённости.

### Requirement 8: Валидационные ворота

**User Story:** Как разработчик, я хочу, чтобы каждое изменение в этом
срезе проходило существующие команды валидации без введения новых
release-ворот, чтобы не ломать существующие KPI.

#### Acceptance Criteria

1. WHEN изменение в рамках этого среза достигает отметки готовности, THE система валидации SHALL подтверждать, что `npm run test:unit` завершился с кодом выхода 0 и без проваленных или пропущенных тестов в этом же коммите.
2. WHEN изменение в рамках этого среза достигает отметки готовности, THE система валидации SHALL подтверждать, что `npm run build` завершился с кодом выхода 0 и без ошибок компиляции в этом же коммите.
3. WHERE изменение влияет на release-артефакты (`summary.json`, `badge-details.json` или иные файлы release-артефактов), WHEN изменение достигает отметки готовности, THE система валидации SHALL подтверждать, что `npm run verify:release` завершился с кодом выхода 0 в этом же коммите.
4. WHEN изменение в рамках этого среза достигает отметки готовности, THE система валидации SHALL подтверждать, что все существующие `Release_KPI_Gate`, включая `assistantActivityLifecycleValidated`, `liveContextCompactionValidated`, `operatorStartupDiagnosticsValidated` и KPI телеметрии разделения, остаются в состоянии «passed» с тем же набором имён ворот, что и до изменения.
5. IF изменение в рамках этого среза вводит новый идентификатор `Release_KPI_Gate`, отсутствующий в наборе ворот до изменения, THEN THE система валидации SHALL отклонять изменение с индикацией, какое именно новое ворото обнаружено, и сохранять предыдущее множество ворот без изменений.
6. IF любая из команд `npm run test:unit`, `npm run build` или (при применимости) `npm run verify:release` завершается с ненулевым кодом выхода либо не запускается в этом же коммите, THEN THE система валидации SHALL отклонять отметку готовности с индикацией, какая именно команда не прошла, и не присваивать изменению статус готовности.

### Requirement 9: Согласованность с source-of-truth документами

**User Story:** Как агент, продолжающий работу после этого среза, я хочу,
чтобы спек оставался downstream-надстройкой над авторитетными документами,
чтобы не возникало конкурирующего источника истины.

#### Acceptance Criteria

1. THE спек `dispatcher-flow-connect` SHALL содержать в разделе Introduction явные ссылки на каждый из следующих документов: `AGENTS.md`, `docs/current-local-services-agent-handoff.md`, `docs/local-services-agent-handoff.md`, `docs/local-services-action-desk-spec.md`, `docs/local-services-developer-map.md`, `docs/product-master-plan.md`, причём каждая ссылка SHALL включать относительный путь от корня репозитория и SHALL быть размещена до первого acceptance criterion.
2. IF хотя бы одно требование спека `dispatcher-flow-connect` противоречит формулировке в любом из перечисленных в критерии 1 source-of-truth документов, THEN THE спек `dispatcher-flow-connect` SHALL присвоить приоритет формулировке source-of-truth документа и SHALL заменить противоречащую формулировку требования на формулировку, согласованную с source-of-truth документом, в рамках того же изменения.
3. THE спек `dispatcher-flow-connect` SHALL не вносить изменений (добавлений, удалений, переформулировок) в файлы спека `multimodal-agents` (включая `requirements.md`, `design.md`, `tasks.md`) в рамках текущего среза.
4. WHEN добавляется или изменяется любое acceptance criterion в спеке `dispatcher-flow-connect`, THE спек `dispatcher-flow-connect` SHALL сослаться минимум на один из перечисленных в критерии 1 source-of-truth документов как на основание формулировки, либо явно зафиксировать, что данный критерий не имеет соответствующего положения в source-of-truth документах.
5. IF в одном из перечисленных в критерии 1 source-of-truth документов отсутствует положение, покрывающее требование спека `dispatcher-flow-connect`, THEN THE спек `dispatcher-flow-connect` SHALL пометить такое требование как downstream-расширение в Introduction и SHALL не утверждать наличие соответствующего положения в source-of-truth документах.

## Out of Scope

Следующие пункты явно исключены из этого спека и не должны добавляться как
требования:

1. Миграция состояния `local-services-workspace` на durable-БД.
2. Реальная интеграция с Telegram.
3. Интеграция с телефонией/SIP.
4. Экспорт в Google Sheets или CRM.
5. Синхронизация календаря/расписания.
6. MCP-коннектор и MCP-сервер.
7. Гейтинг доступа к `/dev` по ролям.
8. Расширенная аналитическая страница.
9. Marketplace-плитки и интеграционные витрины.
10. Login/billing/security-heavy SaaS-оболочка.
11. Любая автономная отправка, диспетчеризация, бронирование, запись в CRM
    или биллинг без `Manual_Approval`.
12. Введение новых `Release_KPI_Gate` в release-валидации.
13. Расширение скоупа на вертикали электрики, стройматериалов, ресторанов,
    отелей и стоматологии.
14. Редизайн стабилизированного layout диспетчера (двухколоночная
    раскладка, breakpoint 1600px, ширины рейла и полосы действий).
