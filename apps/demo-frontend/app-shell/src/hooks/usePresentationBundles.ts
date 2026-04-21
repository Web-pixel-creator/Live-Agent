import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FEATURED_BUNDLE_ID,
  findBundle,
  presentationBundles,
  type PresentationBundle,
} from "../data/presentationBundles";
import {
  buildPresentationBundleIndex,
  buildRuntimePresentationBundle,
  buildRuntimePresentationBundles,
  matchesPresentationBundleRef,
  type RuntimePresentationSessionReplay,
} from "../lib/presentation-bundle-runtime";
import { fetchRuntimeApi } from "@/lib/runtime-api";
import { useWorkspaceRuntime } from "./useWorkspaceRuntime";

async function fetchRuntimeSessionReplay(
  sessionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RuntimePresentationSessionReplay | null> {
  const response = await fetchRuntimeApi(
    `/v1/runtime/session-replay?sessionId=${encodeURIComponent(sessionId)}`,
    {
      headers: {
        "x-operator-role": "viewer",
      },
    },
    fetchImpl,
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`runtime_session_replay_${response.status}`);
  }
  const payload = (await response.json()) as { data?: RuntimePresentationSessionReplay };
  return payload.data ?? null;
}

export function usePresentationBundles() {
  const { caseWikis, cases, runtimeActive } = useWorkspaceRuntime();

  const runtimeBundles = useMemo(
    () => buildRuntimePresentationBundles({ caseWikis, cases }),
    [caseWikis, cases],
  );
  const bundles = runtimeBundles.length > 0 ? runtimeBundles : presentationBundles;
  const runtimeDriven = runtimeBundles.length > 0 && runtimeActive;
  const index = useMemo(() => buildPresentationBundleIndex(bundles), [bundles]);

  const resolveBundle = (ref: string | null | undefined) =>
    bundles.find((item) => matchesPresentationBundleRef(item, ref)) ??
    (ref ? findBundle(ref) : undefined);

  return {
    bundles,
    index,
    runtimeBundles,
    runtimeDriven,
    defaultBundleId: bundles[0]?.id ?? FEATURED_BUNDLE_ID,
    resolveBundle,
  };
}

export function usePresentationBundle(ref: string | null | undefined) {
  const { bundles, runtimeDriven, defaultBundleId, resolveBundle } = usePresentationBundles();
  const { getCaseByRef, getCaseWikiByRef } = useWorkspaceRuntime();

  const resolvedRef = ref ?? defaultBundleId;
  const curatedBundle =
    bundles.find((item) => matchesPresentationBundleRef(item, resolvedRef)) ??
    resolveBundle(resolvedRef);
  const runtimeCaseWiki = getCaseWikiByRef(resolvedRef);
  const fallbackCase = getCaseByRef(resolvedRef);
  const sessionId = runtimeCaseWiki?.sessionId ?? fallbackCase?.sessionId ?? null;

  const replayQuery = useQuery({
    queryKey: ["app-shell", "presentation-replay", sessionId],
    enabled: Boolean(sessionId) && runtimeDriven,
    queryFn: () => fetchRuntimeSessionReplay(sessionId as string),
    staleTime: 30_000,
    retry: 1,
  });

  const bundle = useMemo(() => {
    if (!runtimeCaseWiki) {
      return curatedBundle;
    }
    return buildRuntimePresentationBundle({
      wiki: runtimeCaseWiki,
      replay: replayQuery.data ?? null,
      fallbackCase: fallbackCase ?? null,
    });
  }, [curatedBundle, fallbackCase, replayQuery.data, runtimeCaseWiki]);

  const nextBundle = useMemo(() => {
    if (!bundle || bundles.length < 2) {
      return null;
    }
    const currentIndex = bundles.findIndex((item) => matchesPresentationBundleRef(item, bundle.id));
    if (currentIndex < 0) {
      return null;
    }
    return bundles[(currentIndex + 1) % bundles.length] ?? null;
  }, [bundle, bundles]);

  return {
    bundle,
    bundles,
    defaultBundleId,
    nextBundle,
    replayLoading: replayQuery.isLoading,
    runtimeDriven,
  };
}
