import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("release-readiness emits artifact source-run evidence snapshot output contract", () => {
  const scriptPath = resolve(process.cwd(), "scripts", "release-readiness.ps1");
  const source = readFileSync(scriptPath, "utf8");

  assert.match(source, /sourceRunManifest\.gate\.evidenceSnapshot/);
  assert.match(source, /if \(\$null -ne \$manifestEvidenceSnapshot\)/);
  assert.match(source, /artifact\.source_run_manifest\.evidence: operator_turn_truncation_validated=/);
  assert.match(source, /operator_turn_delete_validated=/);
  assert.match(source, /operator_damage_control_validated=/);
  assert.match(source, /operator_damage_control_total=/);
  assert.match(source, /turn_truncation_status=/);
  assert.match(source, /turn_delete_status=/);
  assert.match(source, /operator_damage_control_status=/);
  assert.match(source, /governance_policy_status=/);
  assert.match(source, /skills_registry_status=/);
  assert.match(source, /plugin_marketplace_status=/);
  assert.match(source, /device_nodes_status=/);
  assert.match(source, /agent_usage_status=/);
  assert.match(source, /runtime_guardrails_signal_paths_status=/);
  assert.match(source, /runtime_guardrails_signal_paths_summary_status=/);
  assert.match(source, /runtime_guardrails_signal_paths_total_paths=/);
  assert.match(source, /runtime_guardrails_signal_paths_primary_path_title=/);
  assert.match(source, /case_wiki_routing_context_status=/);
  assert.match(source, /case_wiki_routing_context_validated=/);
  assert.match(source, /case_wiki_routing_context_observed=/);
  assert.match(source, /case_wiki_routing_context_source=/);
  assert.match(source, /case_wiki_routing_context_focus_id=/);
  assert.match(source, /case_wiki_routing_context_blocker=/);
  assert.match(source, /case_wiki_routing_context_next_action=/);
  assert.match(source, /case_wiki_routing_context_route=/);
  assert.match(source, /case_wiki_routing_context_mode=/);
  assert.match(source, /case_wiki_routing_context_requested_intent=/);
  assert.match(source, /case_wiki_routing_context_routed_intent=/);
  assert.match(source, /case_wiki_context_adoption_status=/);
  assert.match(source, /case_wiki_context_adoption_validated=/);
  assert.match(source, /case_wiki_context_adoption_observed=/);
  assert.match(source, /case_wiki_context_adoption_observed_count=/);
  assert.match(source, /case_wiki_context_adoption_case_wiki_observed_count=/);
  assert.match(source, /case_wiki_context_adoption_input_only_observed_count=/);
  assert.match(source, /case_wiki_context_adoption_unknown_observed_count=/);
  assert.match(source, /case_wiki_context_adoption_case_wiki_rate=/);
  assert.match(source, /provider_usage_status=/);
  assert.match(source, /provider_usage_validated=/);
  assert.match(source, /provider_usage_active_secondary_providers=/);
  assert.match(source, /provider_usage_entries_count=/);
  assert.match(source, /provider_usage_primary_entry_route=/);
  assert.match(source, /provider_usage_primary_entry_capability=/);
  assert.match(source, /provider_usage_primary_entry_selected_provider=/);
  assert.match(source, /provider_usage_primary_entry_selected_model=/);
  assert.match(source, /device_node_updates_status=/);
  assert.match(source, /railway_deploy_summary_present=/);
  assert.match(source, /railway_deploy_summary_status=/);
  assert.match(source, /railway_deploy_summary_deployment_id=/);
  assert.match(source, /railway_deploy_summary_public_url=/);
  assert.match(source, /railway_deploy_summary_badge_endpoint=/);
  assert.match(source, /railway_deploy_summary_badge_details_endpoint=/);
  assert.match(source, /railway_deploy_summary_project_id=/);
  assert.match(source, /railway_deploy_summary_service=/);
  assert.match(source, /railway_deploy_summary_environment=/);
  assert.match(source, /railway_deploy_summary_effective_start_command=/);
  assert.match(source, /railway_deploy_summary_config_source=/);
  assert.match(source, /railway_deploy_summary_root_descriptor_attempted=/);
  assert.match(source, /railway_deploy_summary_root_descriptor_skipped=/);
  assert.match(source, /railway_deploy_summary_expected_ui_url=/);
  assert.match(source, /railway_deploy_summary_public_badge_attempted=/);
  assert.match(source, /railway_deploy_summary_public_badge_skipped=/);
  assert.match(source, /railway_deploy_summary_case_wiki_runtime_surface_ingress_status=/);
  assert.match(source, /railway_deploy_summary_case_wiki_runtime_surface_ingress_observed=/);
  assert.match(source, /railway_deploy_summary_case_wiki_runtime_surface_ingress_context_source=/);
  assert.match(source, /railway_deploy_summary_case_wiki_runtime_surface_ingress_ingress_source=/);
  assert.match(source, /railway_deploy_summary_case_wiki_runtime_surface_ingress_focus_id=/);
  assert.match(source, /railway_deploy_summary_case_wiki_runtime_surface_ingress_blocker=/);
  assert.match(source, /railway_deploy_summary_case_wiki_runtime_surface_ingress_next_action=/);
  assert.match(source, /railway_deploy_summary_case_wiki_runtime_surface_ingress_route=/);
  assert.match(source, /railway_deploy_summary_case_wiki_runtime_surface_ingress_updated_at=/);
  assert.match(source, /repo_publish_summary_present=/);
  assert.match(source, /repo_publish_summary_branch=/);
  assert.match(source, /repo_publish_summary_remote_name=/);
  assert.match(source, /repo_publish_summary_verification_script=/);
  assert.match(source, /repo_publish_summary_verification_skipped=/);
  assert.match(source, /repo_publish_summary_verification_strict=/);
  assert.match(source, /repo_publish_summary_release_evidence_validated=/);
  assert.match(source, /repo_publish_summary_release_evidence_artifacts_count=/);
  assert.match(source, /repo_publish_summary_commit_enabled=/);
  assert.match(source, /repo_publish_summary_push_enabled=/);
  assert.match(source, /repo_publish_summary_pages_enabled=/);
  assert.match(source, /repo_publish_summary_badge_check_enabled=/);
  assert.match(source, /repo_publish_summary_railway_deploy_enabled=/);
  assert.match(source, /repo_publish_summary_railway_frontend_deploy_enabled=/);
  assert.match(source, /repo_publish_summary_runtime_railway_public_url=/);
  assert.match(source, /repo_publish_summary_runtime_railway_frontend_public_url=/);
  assert.match(source, /repo_publish_summary_runtime_railway_no_wait=/);
  assert.match(source, /repo_publish_summary_runtime_railway_frontend_no_wait=/);
  assert.match(source, /repo_publish_summary_artifact_self=/);
  assert.match(source, /repo_publish_summary_artifact_railway_deploy_summary=/);
  assert.match(source, /repo_publish_summary_artifact_release_evidence_report_json=/);
  assert.match(source, /repo_publish_summary_artifact_release_evidence_manifest_json=/);
  assert.match(source, /repo_publish_summary_artifact_badge_details_json=/);
  assert.match(source, /operator_damage_control_latest_verdict=/);
  assert.match(source, /operator_damage_control_latest_source=/);

  assert.match(source, /evidenceSnapshot\.operatorTurnTruncationSummaryValidated expected true/);
  assert.match(source, /evidenceSnapshot\.operatorTurnDeleteSummaryValidated expected true/);
  assert.match(source, /evidenceSnapshot\.operatorDamageControlSummaryValidated expected true/);
  assert.match(source, /evidenceSnapshot\.operatorDamageControlTotal expected >= 1/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceOperatorTurnTruncationStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceOperatorTurnDeleteStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceOperatorDamageControlStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceGovernancePolicyStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceSkillsRegistryStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidencePluginMarketplaceStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceDeviceNodesStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceAgentUsageStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceRuntimeGuardrailsSignalPathsStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceRuntimeGuardrailsSignalPathsSummaryStatus is required/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceRuntimeGuardrailsSignalPathsTotalPaths expected >= 0/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceRuntimeGuardrailsSignalPathsPrimaryPath is required when totalPaths > 0/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiRoutingContextStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiRoutingContextValidated expected true/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiRoutingContextObserved expected true/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiRoutingContextSource expected case_wiki/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiRoutingContextFocusId is required/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiRoutingContextBlocker is required/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiRoutingContextNextAction is required/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiRoutingContextRoute is required/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiRoutingContextMode is required/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiRoutingContextRequestedIntent is required/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiRoutingContextRoutedIntent is required/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiContextAdoptionStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiContextAdoptionValidated expected true/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiContextAdoptionObserved expected true/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiContextAdoptionObservedCount expected >= 3/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiContextAdoptionCaseWikiObservedCount expected >= 3/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiContextAdoptionInputOnlyObservedCount expected >= 0/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiContextAdoptionUnknownObservedCount expected >= 0/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceCaseWikiContextAdoptionCaseWikiRate expected 0\.95\.\.1/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceProviderUsageStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceProviderUsageValidated expected true/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceProviderUsageActiveSecondaryProviders expected >= 0/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceProviderUsageEntriesCount expected >= 1/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceProviderUsagePrimaryEntry is required when entriesCount > 0/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceProviderUsagePrimaryEntry expected route\/capability\/selectedProvider\/selectedModel\/selectionReason when entriesCount > 0/);
  assert.match(source, /evidenceSnapshot\.badgeEvidenceDeviceNodeUpdatesStatus expected pass/);
  assert.match(source, /evidenceSnapshot\.railwayDeploySummaryStatus is required when railwayDeploySummaryPresent=true/);
  assert.match(source, /evidenceSnapshot\.railwayDeploySummaryDeploymentId is required when railwayDeploySummaryPresent=true/);
  assert.match(
    source,
    /Get-OptionalNonEmptyStringPropertyValue -Object \$manifestEvidenceSnapshot -Name "railwayDeploySummaryProjectId"/,
  );
  assert.match(
    source,
    /Get-OptionalNonEmptyStringPropertyValue -Object \$manifestEvidenceSnapshot -Name "railwayDeploySummaryCaseWikiRuntimeSurfaceIngressStatus"/,
  );
  assert.match(
    source,
    /Get-OptionalBooleanPropertyValue -Object \$manifestEvidenceSnapshot -Name "railwayDeploySummaryCaseWikiRuntimeSurfaceIngressObserved"/,
  );
  assert.match(
    source,
    /Get-OptionalBooleanPropertyValue -Object \$manifestEvidenceSnapshot -Name "railwayDeploySummaryRootDescriptorAttempted"/,
  );
  assert.match(
    source,
    /evidenceSnapshot\.railwayDeploySummaryRootDescriptorAttempted and railwayDeploySummaryRootDescriptorSkipped cannot both be true/,
  );
  assert.match(
    source,
    /Get-OptionalBooleanPropertyValue -Object \$manifestEvidenceSnapshot -Name "railwayDeploySummaryPublicBadgeAttempted"/,
  );
  assert.match(
    source,
    /evidenceSnapshot\.railwayDeploySummaryPublicBadgeAttempted and railwayDeploySummaryPublicBadgeSkipped cannot both be true/,
  );
  assert.match(source, /evidenceSnapshot\.repoPublishSummaryVerificationScript is required when repoPublishSummaryPresent=true/);
  assert.match(
    source,
    /Get-OptionalNonEmptyStringPropertyValue -Object \$manifestEvidenceSnapshot -Name "repoPublishSummaryBranch"/,
  );
  assert.match(
    source,
    /Get-OptionalBooleanPropertyValue -Object \$manifestEvidenceSnapshot -Name "repoPublishSummaryVerificationSkipped"/,
  );
  assert.match(source, /evidenceSnapshot\.repoPublishSummaryReleaseEvidenceValidated expected true when repoPublishSummaryPresent=true/);
  assert.match(
    source,
    /Get-OptionalNonNegativeNumberPropertyValue -Object \$manifestEvidenceSnapshot -Name "repoPublishSummaryReleaseEvidenceArtifactsCount"/,
  );
  assert.match(source, /evidenceSnapshot\.repoPublishSummaryRailwayDeployEnabled is required when repoPublishSummaryPresent=true/);
  assert.match(source, /evidenceSnapshot\.repoPublishSummaryRailwayFrontendDeployEnabled is required when repoPublishSummaryPresent=true/);
  assert.match(source, /evidenceSnapshot\.operatorDamageControlLatestVerdict expected one of \[/);
  assert.match(source, /\$allowedOperatorDamageControlLatestVerdicts = @\("allow", "ask", "block"\)/);
  assert.match(source, /evidenceSnapshot\.operatorDamageControlLatestSource expected one of \[/);
  assert.match(source, /\$allowedOperatorDamageControlLatestSources = @\("default", "file", "env_json", "unknown"\)/);
});
