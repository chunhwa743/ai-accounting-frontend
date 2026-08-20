/**
 * The shape of the aiacct API.
 *
 * `npm run gen:api` regenerates `schema.d.ts` from the backend's own
 * `/openapi.json`, which is the authority wherever it has something to say.
 * It is not enough on its own: roughly a third of the endpoints are declared
 * without a `response_model`, so their generated schema is an empty object. The
 * types below cover the whole surface, hand-written from the backend source, and
 * are what the app imports.
 *
 * Two conventions to keep in mind throughout:
 *
 * - **Every money field is a `string`.** The backend serialises `Decimal` as a
 *   JSON string, and an accounting UI that rounds through a float is worthless.
 *   Parse with `@/lib/domain/money`, never `parseFloat`.
 * - **`money_in` and `money_out` are separate fields and exactly one is set.**
 *   A statement is written from the bank's point of view, the mirror of the
 *   client's, so inferring a signed value is where errors creep in.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type RunStatus =
  | "RUNNING"
  | "AWAITING_EXTRACTION_REVIEW"
  | "AWAITING_REVIEW"
  | "COMPLETED"
  | "FAILED";

export type AllocationStatus = "AUTO_POSTED" | "NEEDS_REVIEW" | "CLIENT_QUERY" | "APPROVED";

/** How `account_id` was decided - not where the data came from. */
export type DecisionMethod = "RULE" | "LLM" | "HUMAN";

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export type RiskLevel = "LOW" | "HIGH";

export type NormalBalance = "DEBIT" | "CREDIT";

export type DocumentType =
  | "UNKNOWN"
  | "BANK_STATEMENT"
  | "INVOICE"
  | "RECEIPT"
  | "PAYROLL"
  | "OTHER";

export type MatchType = "CONTAINS" | "PREFIX";

/** Lowercase, unlike every other enum in the API. */
export type Legibility = "clear" | "inferred" | "ambiguous" | "unreadable";

/**
 * Only fields the model could *not* read cleanly appear here. An absent key
 * means the field was clear; `{}` means the whole record was.
 */
export type FieldLegibility = Record<string, Legibility>;

export type ExportFormat = "xlsx" | "csv" | "json" | "journal";

export type ReviewActionName = "approve" | "override" | "split";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type User = {
  id: number;
  name: string;
  email: string;
  last_login_at: string | null;
};

// ---------------------------------------------------------------------------
// Reference data - fetched once and cached; both change rarely
// ---------------------------------------------------------------------------

export type Account = {
  /** Zero-padded and significant: "090" is not 90. */
  code: string;
  name: string;
  type: AccountType;
  default_tax_code: string;
  /** HIGH accounts are routed to review regardless of confidence. */
  risk_level: RiskLevel;
  normal_balance: NormalBalance;
  notes: string | null;
};

export type TaxCode = {
  code: string;
  name: string;
  /** "0.09" - a string, like every other decimal. */
  rate: string;
  claimable: boolean;
  applies_to: "purchase" | "supply" | "both";
  /** BL, TX-RC and IM force human review whatever the confidence. */
  requires_review: boolean;
  description: string | null;
};

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export type ClientProfile = {
  business_description: string;
  gst_registered: boolean;
  /** Used to tell a transfer between the client's own accounts from an expense. */
  own_bank_accounts: string[];
  /** At or above this, a purchase is a fixed asset rather than an expense. */
  capitalisation_threshold: string;
  /** At or above this, a transaction always goes to review. */
  materiality_threshold: string;
  /** Grows from answered client queries. Server-owned; never sent on a PATCH. */
  learned_facts: string[];
};

/** The five writable fields. A PATCH replaces all of them, so always send every one. */
export type ClientProfileInput = Omit<ClientProfile, "learned_facts">;

export type Client = {
  id: number;
  name: string;
  uen: string | null;
  profile: ClientProfile;
  created_at: string | null;
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type BackendDocument = {
  id: number;
  client_id: number;
  document_type: DocumentType;
  original_filename: string;
  mime_type: string;
  page_count: number | null;
  field_legibility: FieldLegibility;
  // Bank statements only
  period_start: string | null;
  period_end: string | null;
  opening_balance: string | null;
  closing_balance: string | null;
  bank_name: string | null;
  account_number: string | null;
  /**
   * Three-state. `true` the arithmetic verified, `false` it did not, and `null`
   * the check could not run because the statement printed no balances. `null` is
   * "not verified" - never a pass.
   */
  reconciles: boolean | null;
  // Invoices, receipts and payroll
  vendor_name: string | null;
  doc_number: string | null;
  doc_date: string | null;
  total_amount: string | null;
  tax_amount: string | null;
  /** What was bought. The bank description only says who was paid. */
  summary: string | null;
};

export type StagedFile = {
  filename: string | null;
  /** A server-side absolute path. Pass it straight back as `file_paths`. */
  path: string;
  bytes: number;
};

/**
 * Uploading creates no Document row and no id - it only stages bytes on disk.
 * Document ids come into existence when a run processes the files.
 */
export type UploadResult = {
  client_id: number;
  staged: StagedFile[];
};

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export type StartRunInput = {
  document_ids?: number[];
  file_paths?: string[];
};

export type StartRunResult = {
  run_id: number;
  status: "RUNNING";
};

export type Run = {
  id: number;
  client_id: number;
  status: RunStatus;
  model_used: string | null;
  llm_calls: number;
  input_tokens: number;
  output_tokens: number;
  started_at: string | null;
  completed_at: string | null;
  /** Sparse - a missing key means zero. */
  by_status: Partial<Record<AllocationStatus, number>>;
  /** Sparse - a missing key means zero. */
  by_decision_method: Partial<Record<DecisionMethod, number>>;
  auto_post_rate: number | null;
  /** NEEDS_REVIEW + CLIENT_QUERY. */
  needs_attention: number;
};

export type CompleteRunResult = {
  run_id: number;
  status: "COMPLETED";
  /** Items left open. Completing does not refuse them, but the UI must say so. */
  still_unresolved: number;
  /** Basenames on the server, not URLs. Download via the export endpoint. */
  exports: {
    review_xlsx: string;
    review_csv: string;
    journal_csv: string;
    client_queries: string;
    summary: string;
  };
};

/** Only these two codes ever reach HTTP, though the validator knows more. */
export type IssueCode = "unreadable_identifier" | "balance_mismatch";

export type ExtractionIssue = {
  document_id: number | null;
  code: IssueCode | string;
  message: string;
  /** Set for `unreadable_identifier`; absent for `balance_mismatch`. */
  field: string | null;
  line_no: number | null;
  page: number | null;
};

export type ProgressEvent = { message: string };
export type DoneEvent = { status: RunStatus };

// ---------------------------------------------------------------------------
// Transactions and allocations
// ---------------------------------------------------------------------------

export type BankTransaction = {
  id: number;
  document_id: number;
  line_no: number;
  /** ISO `YYYY-MM-DD`. Display as `dd MMM yyyy`. */
  txn_date: string;
  /** Exactly as printed. Never edited except to fix a misread. */
  raw_description: string;
  bank_reference: string | null;
  money_in: string | null;
  money_out: string | null;
  balance_after: string | null;
  page: number | null;
  field_legibility: FieldLegibility;
};

export type Allocation = {
  id: number;
  bank_transaction_id: number;
  run_id: number;
  amount: string;
  /** `null` means genuinely unresolved - not an error, and not Suspense. */
  account_id: string | null;
  account_name: string | null;
  tax_code: string | null;
  decision_method: DecisionMethod;
  /** `null` whenever a person decided. A human's answer is not a probability. */
  confidence: number | null;
  status: AllocationStatus;
  /** Must be shown. Without it the accountant has to re-derive the answer. */
  reasoning: string | null;
  /** The client-facing question, set when the status is CLIENT_QUERY. */
  question: string | null;
  matched_document_id: number | null;
  matched_rule_id: number | null;
  approved_by: number | null;
  approved_at: string | null;
};

export type ReviewItem = {
  allocation: Allocation;
  transaction: BankTransaction;
};

/**
 * Already sorted so the most valuable attention comes first: client queries,
 * then reviews, then by descending amount. There is no pagination.
 */
export type TransactionList = {
  run_id: number;
  count: number;
  items: ReviewItem[];
};

export type TransactionDetail = {
  transaction: BankTransaction;
  /** Every run's allocations for this line, oldest first. Filter by `run_id`. */
  allocations: Allocation[];
  document: BackendDocument | null;
  matched_document: BackendDocument | null;
};

// ---------------------------------------------------------------------------
// Reviewing
// ---------------------------------------------------------------------------

export type SplitPart = {
  account_code: string;
  /** A decimal string. Parts must sum to the bank line to within a cent. */
  amount: string;
};

export type ReviewAction = {
  action: ReviewActionName;
  /** Required for `override`. */
  account_code?: string;
  /** Optional on `override`; defaults to the account's own default. */
  tax_code?: string;
  /** On an override this *overwrites* the model's reasoning. */
  note?: string;
  /** Honoured for approve and override; ignored for split. */
  create_rule?: boolean;
  /** Required for `split`. */
  parts?: SplitPart[];
};

export type CreatedRule = {
  id: number;
  match_pattern: string;
  account_id: string;
};

export type ReviewResult = {
  /** After a split this is only the first of the new allocations. */
  allocation: Allocation;
  message: string;
  rule_created: CreatedRule | null;
  /** How many past transactions the new pattern would have matched. */
  rule_preview_count: number | null;
  /** Not an error - the correction applied, only the rule was refused. */
  rule_blocked_reason: string | null;
};

export type BulkReviewInput = {
  allocation_ids: number[];
  /** Accepted but ignored by the backend: this endpoint always approves. */
  action?: ReviewActionName;
  create_rule?: boolean;
};

export type BulkReviewResult = {
  approved: number[];
  skipped: { allocation_id: number; reason: string }[];
};

export type QueryAnswerInput = {
  answer: string;
  /** Optional. Without it the allocation stays open as a client query. */
  account_code?: string;
};

export type QueryAnswerResult = {
  allocation_id: number;
  message: string;
  learned_fact_recorded: boolean;
};

export type ExtractionFixInput = {
  field_name: string;
  new_value: string;
  /** Supply exactly one of these two. */
  document_id?: number;
  transaction_id?: number;
};

export type ExtractionFixResult = {
  correction_id: number;
  field: string;
  old_value: string | null;
  new_value: string;
};

// ---------------------------------------------------------------------------
// Learned rules and metrics
// ---------------------------------------------------------------------------

export type MerchantRule = {
  id: number;
  client_id: number;
  match_pattern: string;
  match_type: MatchType;
  account_id: string;
  account_name: string | null;
  tax_code: string | null;
  /** How many times an accountant approved a result this rule produced. */
  confirm_count: number;
  is_active: boolean;
  last_applied_at: string | null;
  created_at: string | null;
};

export type RunMetric = {
  run_id: number;
  started_at: string | null;
  status: RunStatus;
  /** Counts allocations, not bank lines - a split contributes more than one. */
  transactions: number;
  /** Decays as items are approved, so poor as a trend. */
  auto_post_rate: number;
  /** The number that actually shows the learning curve. */
  resolved_without_model: number;
  llm_calls: number;
  needs_attention: number;
};

export type ClientMetrics = {
  client_id: number;
  active_rules: number;
  runs: RunMetric[];
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type ClientQuery = {
  allocation_id: number;
  date: string;
  description: string;
  amount: string;
  direction: "received" | "paid";
  /** Already written for sending to the client. */
  question: string;
};

export type RunExportJson = {
  summary: {
    run_id: number;
    client_id: number;
    status: RunStatus;
    transactions: number;
    by_status: Record<string, number>;
    by_decision_method: Record<string, number>;
    auto_post_rate: number;
    needs_attention: number;
    resolved_without_model: number;
    llm_calls: number;
    input_tokens: number;
    output_tokens: number;
    journal_entries: number;
    /** Non-empty is a real problem: an entry whose debits and credits differ. */
    unbalanced_entries: string[];
  };
  client_queries: ClientQuery[];
};

export type Health = {
  status: string;
  model: string;
  /** True when the backend is running the deterministic offline provider. */
  offline_provider: boolean;
};
