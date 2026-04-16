import type {
  CaseWiki,
  CaseWikiNextAction,
  CaseWikiOpenQuestion,
  CaseWikiPriority,
  CaseWikiRoutingLane,
  CaseWikiRoutingPackItem,
  RuntimeOperatorQueueAction,
  RuntimeOperatorQueueItem,
  RuntimeOperatorQueuePriority,
  RuntimeOperatorQueueSnapshot,
} from "@mla/contracts";

function toNonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((item) => toNonEmptyString(item)).filter((item): item is string => Boolean(item)))];
}

function parseIsoToMs(value: string | null | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveCaseWikiPriorityScore(priority: CaseWikiPriority | null | undefined): number {
  switch (priority) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
    default:
      return 2;
  }
}

function resolveQueuePriority(params: {
  blocking: boolean;
  approvalRequired: boolean;
}): RuntimeOperatorQueuePriority {
  if (params.approvalRequired) {
    return "critical";
  }
  if (params.blocking) {
    return "high";
  }
  return "medium";
}

function resolveLaneFromNextAction(nextAction: CaseWikiNextAction | null): CaseWikiRoutingLane | null {
  switch (nextAction?.type) {
    case "approval_request":
      return "approval_queue";
    case "document_request":
      return "customer_followup";
    case "workflow_resume":
      return "workflow_resume";
    case "ui_task":
      return "ui_task";
    case "live_followup":
      return "live_followup";
    case "operator_followup":
      return "operator_followup";
    default:
      return null;
  }
}

function resolveSavedViewAction(params: {
  route: CaseWikiRoutingPackItem["route"] | null;
  nextAction: CaseWikiNextAction | null;
}): RuntimeOperatorQueueAction | null {
  const lane = params.route?.lane ?? resolveLaneFromNextAction(params.nextAction);
  switch (lane) {
    case "approval_queue":
      return {
        label: "Approvals View",
        shortLabel: "Approvals",
        actionId: "saved_view_approvals",
      };
    case "workflow_resume":
    case "ui_task":
      return {
        label: "Runtime View",
        shortLabel: "Runtime",
        actionId: "saved_view_runtime",
      };
    case "customer_followup":
    case "live_followup":
    case "operator_followup":
      return {
        label: "Incidents View",
        shortLabel: "Incidents",
        actionId: "saved_view_incidents",
      };
    default:
      return null;
  }
}

function resolveTopBlockingQuestion(caseWiki: CaseWiki): CaseWikiOpenQuestion | null {
  return caseWiki.highlights.topBlockingQuestion
    ?? caseWiki.openQuestions.find((item) => item.blocking === true)
    ?? caseWiki.openQuestions[0]
    ?? null;
}

function resolveRoutingItems(caseWiki: CaseWiki): CaseWikiRoutingPackItem[] {
  return [...caseWiki.routingPack.questions, ...caseWiki.routingPack.proofs];
}

function resolveBestRoutingItem(caseWiki: CaseWiki): CaseWikiRoutingPackItem | null {
  const items = resolveRoutingItems(caseWiki);
  if (items.length === 0) {
    return null;
  }
  return items
    .slice()
    .sort((left, right) => {
      if (left.route.blocking !== right.route.blocking) {
        return left.route.blocking ? -1 : 1;
      }
      if (left.route.approvalRequired !== right.route.approvalRequired) {
        return left.route.approvalRequired ? -1 : 1;
      }
      const priorityDelta =
        resolveCaseWikiPriorityScore(left.route.priority) - resolveCaseWikiPriorityScore(right.route.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      const leftDueBy = parseIsoToMs(left.route.dueBy);
      const rightDueBy = parseIsoToMs(right.route.dueBy);
      if (leftDueBy !== rightDueBy) {
        if (leftDueBy === 0) {
          return 1;
        }
        if (rightDueBy === 0) {
          return -1;
        }
        return leftDueBy - rightDueBy;
      }
      return parseIsoToMs(right.nextAction?.dueBy) - parseIsoToMs(left.nextAction?.dueBy);
    })[0] ?? null;
}

function buildQueueMeta(params: {
  focusLabel: string | null;
  blockerText: string | null;
  nextStepText: string | null;
  targetText: string | null;
  ownerText: string | null;
  dueBy: string | null;
}): string {
  const parts: string[] = [];
  if (params.focusLabel) {
    parts.push(`Focus: ${params.focusLabel}.`);
  }
  if (params.blockerText) {
    parts.push(`Blocker: ${params.blockerText}.`);
  }
  if (params.nextStepText && params.nextStepText !== params.blockerText) {
    parts.push(`Next: ${params.nextStepText}.`);
  }
  if (params.targetText) {
    parts.push(`Target: ${params.targetText}.`);
  }
  if (params.ownerText) {
    parts.push(`Owner: ${params.ownerText}.`);
  }
  if (params.dueBy) {
    parts.push(`Due: ${params.dueBy}.`);
  }
  return parts.join(" ") || "Open the compiled case follow-up before scanning the wider board.";
}

export function buildRuntimeOperatorQueueItem(caseWiki: CaseWiki): RuntimeOperatorQueueItem | null {
  const remediation = caseWiki.operatorPreviewPack.remediation;
  const routingItem = resolveBestRoutingItem(caseWiki);
  const route = routingItem?.route ?? null;
  const nextAction = caseWiki.recommendedNextAction ?? null;
  const blockingQuestion = resolveTopBlockingQuestion(caseWiki);
  const draft = remediation.draft ?? null;

  if (!draft && !route && !nextAction && !blockingQuestion) {
    return null;
  }

  const focusLabel =
    toNonEmptyString(remediation.focusLabel) ??
    toNonEmptyString(routingItem?.focusLabel) ??
    toNonEmptyString(blockingQuestion?.question) ??
    toNonEmptyString(caseWiki.overview.title);
  const blockerText =
    toNonEmptyString(blockingQuestion?.question) ??
    toNonEmptyString(route?.summary) ??
    toNonEmptyString(caseWiki.overview.missingEvidenceSummary) ??
    null;
  const nextStepText =
    toNonEmptyString(draft?.summary) ??
    toNonEmptyString(nextAction?.summary) ??
    toNonEmptyString(nextAction?.title) ??
    toNonEmptyString(blockingQuestion?.suggestedNextStep) ??
    null;
  const ownerText =
    toNonEmptyString(draft?.owner) ??
    toNonEmptyString(nextAction?.owner) ??
    toNonEmptyString(blockingQuestion?.owner) ??
    toNonEmptyString(route?.owner) ??
    null;
  const targetText = toNonEmptyString(draft?.targetLabel);
  const dueBy = toNonEmptyString(draft?.dueBy) ?? toNonEmptyString(nextAction?.dueBy) ?? toNonEmptyString(route?.dueBy);
  const blocking = blockingQuestion?.blocking === true || route?.blocking === true || nextAction?.blocking === true;
  const approvalRequired = route?.approvalRequired === true || nextAction?.type === "approval_request";
  const viewAction = resolveSavedViewAction({ route, nextAction });

  return {
    id: `operator_queue:${caseWiki.sessionId ?? caseWiki.caseId}`,
    key: `case_wiki:${caseWiki.sessionId ?? caseWiki.caseId}`,
    source: "case_wiki",
    generatedAt: caseWiki.generatedAt,
    caseId: caseWiki.caseId,
    sessionId: caseWiki.sessionId,
    tone: blocking ? "fail" : "watch",
    priority: resolveQueuePriority({
      blocking,
      approvalRequired,
    }),
    blocking,
    kicker: approvalRequired ? "Approval lane" : blocking ? "Case blocker" : "Case next step",
    title:
      toNonEmptyString(draft?.title) ??
      toNonEmptyString(nextAction?.title) ??
      toNonEmptyString(caseWiki.overview.title) ??
      `Case ${caseWiki.caseId}`,
    meta: buildQueueMeta({
      focusLabel,
      blockerText,
      nextStepText,
      targetText,
      ownerText,
      dueBy,
    }),
    focus: {
      kind: remediation.focusKind ?? routingItem?.focusKind ?? (blockingQuestion ? "question" : null),
      id: toNonEmptyString(remediation.focusId) ?? toNonEmptyString(routingItem?.focusId) ?? toNonEmptyString(blockingQuestion?.id),
      label: focusLabel,
      summary:
        toNonEmptyString(draft?.summary) ??
        toNonEmptyString(nextAction?.summary) ??
        toNonEmptyString(route?.summary) ??
        toNonEmptyString(blockingQuestion?.suggestedNextStep) ??
        toNonEmptyString(caseWiki.overview.summary),
    },
    question: blockingQuestion
      ? {
          id: toNonEmptyString(blockingQuestion.id),
          priority: blockingQuestion.priority,
          blocking: blockingQuestion.blocking === true,
          owner: toNonEmptyString(blockingQuestion.owner),
          question: toNonEmptyString(blockingQuestion.question),
          suggestedNextStep: toNonEmptyString(blockingQuestion.suggestedNextStep),
        }
      : null,
    route: route
      ? {
          lane: route.lane,
          owner: toNonEmptyString(route.owner),
          priority: route.priority,
          status: toNonEmptyString(route.status),
          blocking: route.blocking === true,
          approvalRequired: route.approvalRequired === true,
          dueBy: toNonEmptyString(route.dueBy),
          summary: toNonEmptyString(route.summary),
        }
      : null,
    remediation: {
      focusKind: remediation.focusKind,
      focusId: toNonEmptyString(remediation.focusId),
      focusLabel: toNonEmptyString(remediation.focusLabel),
      draft,
    },
    recommendedNextAction: nextAction
      ? {
          type: nextAction.type,
          title: toNonEmptyString(nextAction.title),
          owner: toNonEmptyString(nextAction.owner),
          summary: toNonEmptyString(nextAction.summary),
          dueBy: toNonEmptyString(nextAction.dueBy),
          blocking: nextAction.blocking === true,
        }
      : null,
    compliance: {
      templateId: caseWiki.compliance.templateId,
      piiRedactionLevel: caseWiki.compliance.controls.piiRedactionLevel,
      expectedSignatureStatus: caseWiki.compliance.evidenceSigning.expectedSignatureStatus,
    },
    primary: draft
      ? {
          label: "Open Remediation",
          shortLabel: "Open",
          actionId: "open_case_wiki_remediation",
        }
      : viewAction ?? {
          label: "Refresh Summary",
          shortLabel: "Refresh",
          actionId: "refresh_summary",
        },
    secondary: draft
      ? {
          label: "Copy Draft",
          shortLabel: "Copy",
          actionId: "copy_case_wiki_remediation_draft",
          kind: "secondary",
        }
      : null,
    sourceRefs: uniqueStrings([
      ...(draft?.sourceRefs ?? []),
      ...(blockingQuestion?.sourceRefs ?? []),
      ...(nextAction?.sourceRefs ?? []),
      ...(routingItem?.sourceRefs ?? []),
      ...caseWiki.evidencePack.sourceRefs,
    ]),
  };
}

function resolveQueuePriorityRank(priority: RuntimeOperatorQueuePriority): number {
  switch (priority) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
    default:
      return 2;
  }
}

export function buildRuntimeOperatorQueueSnapshot(params: {
  tenantId: string;
  caseWikis: CaseWiki[];
  generatedAt?: string;
  limit?: number;
}): RuntimeOperatorQueueSnapshot {
  const limit = Number.isFinite(Number(params.limit)) ? Math.max(1, Math.floor(Number(params.limit))) : 6;
  const items = params.caseWikis
    .map((item) => buildRuntimeOperatorQueueItem(item))
    .filter((item): item is RuntimeOperatorQueueItem => Boolean(item))
    .sort((left, right) => {
      const priorityDelta = resolveQueuePriorityRank(left.priority) - resolveQueuePriorityRank(right.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      if (left.blocking !== right.blocking) {
        return left.blocking ? -1 : 1;
      }
      const leftDueBy = parseIsoToMs(left.recommendedNextAction?.dueBy ?? left.route?.dueBy ?? null);
      const rightDueBy = parseIsoToMs(right.recommendedNextAction?.dueBy ?? right.route?.dueBy ?? null);
      if (leftDueBy !== rightDueBy) {
        if (leftDueBy === 0) {
          return 1;
        }
        if (rightDueBy === 0) {
          return -1;
        }
        return leftDueBy - rightDueBy;
      }
      const leftUpdatedAt = parseIsoToMs(left.generatedAt);
      const rightUpdatedAt = parseIsoToMs(right.generatedAt);
      return rightUpdatedAt - leftUpdatedAt;
    })
    .slice(0, limit);

  return {
    schemaVersion: 1,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    tenantId: params.tenantId,
    totalItems: items.length,
    blockingItems: items.filter((item) => item.blocking === true).length,
    items,
  };
}
