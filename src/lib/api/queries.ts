"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { fetchApi } from "./client";
import type {
  Account,
  Allocation,
  BackendDocument,
  BulkReviewInput,
  BulkReviewResult,
  Client,
  ClientMetrics,
  ClientProfile,
  ClientProfileInput,
  CompleteRunResult,
  ExtractionFixInput,
  ExtractionFixResult,
  ExtractionIssue,
  MerchantRule,
  QueryAnswerInput,
  QueryAnswerResult,
  ReviewAction,
  ReviewResult,
  Run,
  RunExportJson,
  StartRunInput,
  StartRunResult,
  TaxCode,
  TransactionDetail,
  TransactionList,
  UploadResult,
  User,
} from "./types";

/** One place to derive every cache key, so invalidation cannot drift. */
export const keys = {
  me: ["me"] as const,
  accounts: ["chart-of-accounts"] as const,
  taxCodes: ["tax-codes"] as const,
  clients: ["clients"] as const,
  client: (id: number) => ["client", id] as const,
  clientProfile: (id: number) => ["client", id, "profile"] as const,
  clientMetrics: (id: number) => ["client", id, "metrics"] as const,
  clientRules: (id: number) => ["client", id, "rules"] as const,
  run: (id: number) => ["run", id] as const,
  runTransactions: (id: number) => ["run", id, "transactions"] as const,
  runIssues: (id: number) => ["run", id, "issues"] as const,
  runSummary: (id: number) => ["run", id, "summary"] as const,
  transaction: (id: number) => ["transaction", id] as const,
  document: (id: number) => ["document", id] as const,
};

/**
 * The chart of accounts and the tax codes are effectively immutable - the
 * backend caches them at module level and the AI selects from them but never
 * adds to them. Fetch once per session.
 */
const REFERENCE_DATA = { staleTime: Infinity, gcTime: Infinity } as const;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => fetchApi<User>("/auth/me"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: keys.accounts,
    queryFn: () => fetchApi<Account[]>("/chart-of-accounts"),
    ...REFERENCE_DATA,
  });
}

export function useTaxCodes() {
  return useQuery({
    queryKey: keys.taxCodes,
    queryFn: () => fetchApi<TaxCode[]>("/tax-codes"),
    ...REFERENCE_DATA,
  });
}

export function useClients() {
  return useQuery({
    queryKey: keys.clients,
    queryFn: () => fetchApi<Client[]>("/clients"),
    staleTime: 60 * 1000,
  });
}

export function useClient(clientId: number) {
  const clients = useClients();
  return {
    ...clients,
    data: clients.data?.find((client) => client.id === clientId),
  };
}

export function useClientProfile(clientId: number) {
  return useQuery({
    queryKey: keys.clientProfile(clientId),
    queryFn: () => fetchApi<ClientProfile>(`/clients/${clientId}/profile`),
    staleTime: 60 * 1000,
  });
}

/** The only way to enumerate a client's runs - there is no `GET /runs`. */
export function useClientMetrics(clientId: number) {
  return useQuery({
    queryKey: keys.clientMetrics(clientId),
    queryFn: () => fetchApi<ClientMetrics>(`/clients/${clientId}/metrics`),
    staleTime: 30 * 1000,
  });
}

export function useClientRules(clientId: number) {
  return useQuery({
    queryKey: keys.clientRules(clientId),
    queryFn: () => fetchApi<MerchantRule[]>(`/clients/${clientId}/memory/rules`),
    staleTime: 30 * 1000,
  });
}

/**
 * Polls while the run is in flight.
 *
 * This is the primary progress mechanism, not a fallback. The backend's event
 * stream holds a single database session whose identity map returns a cached
 * row, so a stream opened while the run is RUNNING never observes the
 * transition and closes after five minutes without a `done` event.
 */
export function useRun(runId: number, options?: Partial<UseQueryOptions<Run>>) {
  return useQuery<Run>({
    queryKey: keys.run(runId),
    queryFn: () => fetchApi<Run>(`/runs/${runId}`),
    refetchInterval: (query) => (query.state.data?.status === "RUNNING" ? 1500 : false),
    ...options,
  });
}

export function useRunTransactions(runId: number, enabled = true) {
  return useQuery({
    queryKey: keys.runTransactions(runId),
    queryFn: () => fetchApi<TransactionList>(`/runs/${runId}/transactions`),
    enabled,
  });
}

export function useRunIssues(runId: number, enabled = true) {
  return useQuery({
    queryKey: keys.runIssues(runId),
    queryFn: () => fetchApi<ExtractionIssue[]>(`/runs/${runId}/issues`),
    enabled,
  });
}

/** The `json` export carries the client queries, already written for sending. */
export function useRunSummary(runId: number, enabled = true) {
  return useQuery({
    queryKey: keys.runSummary(runId),
    queryFn: () => fetchApi<RunExportJson>(`/runs/${runId}/export?format=json`),
    enabled,
  });
}

export function useTransaction(transactionId: number | null) {
  return useQuery({
    queryKey: keys.transaction(transactionId ?? 0),
    queryFn: () => fetchApi<TransactionDetail>(`/transactions/${transactionId}`),
    enabled: transactionId !== null,
  });
}

export function useDocument(documentId: number | null) {
  return useQuery({
    queryKey: keys.document(documentId ?? 0),
    queryFn: () => fetchApi<BackendDocument>(`/documents/${documentId}`),
    enabled: documentId !== null,
    staleTime: 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export function useUploadDocuments(clientId: number) {
  return useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      // The backend reads a repeated field named `files`.
      for (const file of files) form.append("files", file);
      return fetchApi<UploadResult>(`/clients/${clientId}/documents`, {
        method: "POST",
        body: form,
      });
    },
  });
}

export function useStartRun(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartRunInput) =>
      fetchApi<StartRunResult>(`/clients/${clientId}/runs`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.clientMetrics(clientId) });
    },
  });
}

type ReviewVariables = { allocationId: number; action: ReviewAction };

/**
 * Approve, correct or split one allocation.
 *
 * Everything on the run is invalidated afterwards rather than patched in place:
 * a split replaces one allocation with several and only returns the first, an
 * override rewrites the reasoning, and an approval can bump a rule's confirm
 * count. Refetching is the honest way to show what actually happened.
 */
export function useReviewAllocation(runId: number, clientId: number) {
  const queryClient = useQueryClient();
  return useMutation<ReviewResult, Error, ReviewVariables>({
    mutationFn: ({ allocationId, action }) =>
      fetchApi<ReviewResult>(`/allocations/${allocationId}/review`, {
        method: "POST",
        body: JSON.stringify(action),
      }),
    onSuccess: (_result, { allocationId }) => {
      void queryClient.invalidateQueries({ queryKey: keys.runTransactions(runId) });
      void queryClient.invalidateQueries({ queryKey: keys.run(runId) });
      void queryClient.invalidateQueries({ queryKey: keys.clientRules(clientId) });
      void queryClient.invalidateQueries({ queryKey: keys.transaction(allocationId) });
      void queryClient.invalidateQueries({ queryKey: ["transaction"] });
    },
  });
}

export function useBulkApprove(runId: number, clientId: number) {
  const queryClient = useQueryClient();
  return useMutation<BulkReviewResult, Error, BulkReviewInput>({
    mutationFn: (input) =>
      fetchApi<BulkReviewResult>(`/runs/${runId}/bulk-review`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.runTransactions(runId) });
      void queryClient.invalidateQueries({ queryKey: keys.run(runId) });
      void queryClient.invalidateQueries({ queryKey: keys.clientRules(clientId) });
    },
  });
}

export function useAnswerQuery(runId: number, clientId: number) {
  const queryClient = useQueryClient();
  return useMutation<
    QueryAnswerResult,
    Error,
    { allocationId: number; input: QueryAnswerInput }
  >({
    mutationFn: ({ allocationId, input }) =>
      fetchApi<QueryAnswerResult>(`/allocations/${allocationId}/query/answer`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      // The response does not include the updated allocation, so refetch.
      void queryClient.invalidateQueries({ queryKey: keys.runTransactions(runId) });
      void queryClient.invalidateQueries({ queryKey: keys.run(runId) });
      void queryClient.invalidateQueries({ queryKey: keys.runSummary(runId) });
      void queryClient.invalidateQueries({ queryKey: keys.clientProfile(clientId) });
    },
  });
}

export function useCompleteRun(runId: number, clientId: number) {
  const queryClient = useQueryClient();
  return useMutation<CompleteRunResult, Error, void>({
    mutationFn: () => fetchApi<CompleteRunResult>(`/runs/${runId}/complete`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.run(runId) });
      void queryClient.invalidateQueries({ queryKey: keys.clientMetrics(clientId) });
    },
  });
}

export function useExtractionFix(runId: number) {
  const queryClient = useQueryClient();
  return useMutation<ExtractionFixResult, Error, ExtractionFixInput>({
    mutationFn: (input) =>
      fetchApi<ExtractionFixResult>("/extraction-fix", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.runIssues(runId) });
      void queryClient.invalidateQueries({ queryKey: ["document"] });
    },
  });
}

export function useDeleteRule(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (ruleId) =>
      fetchApi<void>(`/clients/${clientId}/memory/rules/${ruleId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.clientRules(clientId) });
      void queryClient.invalidateQueries({ queryKey: keys.clientMetrics(clientId) });
    },
  });
}

export function useUpdateClientProfile(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation<ClientProfile, Error, ClientProfileInput>({
    mutationFn: (input) =>
      fetchApi<ClientProfile>(`/clients/${clientId}/profile`, {
        method: "PATCH",
        // Every writable field must be sent: the backend resets anything omitted
        // to its default rather than leaving it alone.
        body: JSON.stringify(input),
      }),
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.clientProfile(clientId), profile);
      void queryClient.invalidateQueries({ queryKey: keys.clients });
    },
  });
}

/** Exposed for screens that need the raw allocation type in a callback. */
export type { Allocation };
