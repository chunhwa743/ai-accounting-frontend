import type {
  AccountType,
  AllocationStatus,
  DecisionMethod,
  Legibility,
  RunStatus,
} from "@/lib/api/types";

/**
 * The words this interface uses, in one place.
 *
 * The system's value is not the categorisation - it is knowing which
 * categorisations to distrust. Most of what follows exists to make that legible:
 * why a line was flagged, who decided it, and how far the answer can be trusted.
 */

// ---------------------------------------------------------------------------
// Decision method
// ---------------------------------------------------------------------------

export const DECISION_METHOD: Record<
  DecisionMethod,
  { label: string; explanation: string }
> = {
  RULE: {
    label: "learned rule",
    explanation:
      "A rule you taught the system for this client matched. No model was called.",
  },
  LLM: {
    label: "suggested",
    explanation: "The model proposed this coding. Confirm it or correct it.",
  },
  HUMAN: {
    label: "set by you",
    explanation: "A person decided this, so there is no confidence score.",
  },
};

// ---------------------------------------------------------------------------
// Allocation status
// ---------------------------------------------------------------------------

export const ALLOCATION_STATUS: Record<
  AllocationStatus,
  { label: string; explanation: string }
> = {
  CLIENT_QUERY: {
    label: "Client query",
    explanation:
      "Nobody in the office can resolve this. It needs an answer from the client, which means an email and then a wait.",
  },
  NEEDS_REVIEW: {
    label: "Needs review",
    explanation:
      "A judgement you can make in seconds from knowing the client. Confirm the coding or correct it.",
  },
  AUTO_POSTED: {
    label: "Auto-posted",
    explanation: "Confident enough that nobody needs to look. Collapsed by default.",
  },
  APPROVED: {
    label: "Approved",
    explanation: "A person has signed this off.",
  },
};

// ---------------------------------------------------------------------------
// Run status
// ---------------------------------------------------------------------------

export const RUN_STATUS: Record<RunStatus, { label: string; explanation: string }> = {
  RUNNING: {
    label: "Running",
    explanation: "Reading the files and coding the transactions.",
  },
  AWAITING_EXTRACTION_REVIEW: {
    label: "Needs a reading fixed",
    explanation:
      "Something on a page could not be read reliably. This is rare, and it is the one place you have to look at the source document.",
  },
  AWAITING_REVIEW: {
    label: "Ready to review",
    explanation: "The normal stopping point. Work through the queue whenever you like.",
  },
  COMPLETED: {
    label: "Completed",
    explanation: "Signed off. The exports are ready.",
  },
  FAILED: {
    label: "Failed",
    explanation: "This run stopped with an error and cannot be resumed. Start a new one.",
  },
};

// ---------------------------------------------------------------------------
// Reasoning
// ---------------------------------------------------------------------------

const FLAG_MARKER = "\n\nFlagged for review: ";

/**
 * The router appends its reason to the model's reasoning with a fixed marker.
 * Separating them lets the UI answer two different questions - *what did it
 * think* and *why am I being asked* - instead of running them together.
 */
export function splitReasoning(reasoning: string | null): {
  thinking: string | null;
  flaggedBecause: string | null;
} {
  if (!reasoning) return { thinking: null, flaggedBecause: null };
  const at = reasoning.indexOf(FLAG_MARKER);
  if (at === -1) return { thinking: reasoning.trim() || null, flaggedBecause: null };
  return {
    thinking: reasoning.slice(0, at).trim() || null,
    flaggedBecause: reasoning.slice(at + FLAG_MARKER.length).trim() || null,
  };
}

// ---------------------------------------------------------------------------
// Legibility
// ---------------------------------------------------------------------------

export const LEGIBILITY: Record<Legibility, string> = {
  clear: "read cleanly off the page",
  inferred: "not fully legible - the model filled in the gaps from context",
  ambiguous: "could be read more than one way",
  unreadable: "could not be read",
};

export function legibilityNote(field: string, level: Legibility): string {
  return `${field.replace(/_/g, " ")}: ${LEGIBILITY[level]}. Worth glancing at the source document.`;
}

// ---------------------------------------------------------------------------
// Chart of accounts
// ---------------------------------------------------------------------------

export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  "REVENUE",
  "EXPENSE",
  "ASSET",
  "LIABILITY",
  "EQUITY",
];

/**
 * Which financial statement an amount lands on. Accountants work by code, but
 * the type is what determines where the number ends up.
 */
export const ACCOUNT_TYPE_STATEMENT: Record<AccountType, string> = {
  REVENUE: "Profit & Loss",
  EXPENSE: "Profit & Loss",
  ASSET: "Balance Sheet",
  LIABILITY: "Balance Sheet",
  EQUITY: "Balance Sheet",
};

export const HIGH_RISK_EXPLANATION =
  "High risk: an error here changes the tax computation or the balance sheet, so it is always routed to review however confident the system is.";

// ---------------------------------------------------------------------------
// Tax codes
// ---------------------------------------------------------------------------

/**
 * The three codes that force a human look. These are claimability and filing
 * decisions with a direct cash consequence, so a bare code is not enough.
 */
export const TAX_CODE_WHY_REVIEW: Record<string, string> = {
  BL: "Blocked input tax. GST on medical, private car and club costs cannot be reclaimed even with a valid tax invoice.",
  "TX-RC":
    "Reverse charge on imported services. Needs extra treatment when the GST return is filed.",
  IM: "Import GST. Needs extra treatment when the GST return is filed.",
};

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

export function reconcilesLabel(reconciles: boolean | null): {
  label: string;
  explanation: string;
  tone: "ok" | "bad" | "unknown";
} {
  if (reconciles === true) {
    return {
      label: "Reconciled",
      explanation: "The statement's own arithmetic adds up.",
      tone: "ok",
    };
  }
  if (reconciles === false) {
    return {
      label: "Did not reconcile",
      explanation:
        "The statement's arithmetic did not add up, so everything on it carries a confidence penalty.",
      tone: "bad",
    };
  }
  return {
    label: "Not verified",
    explanation:
      "The check could not run because the file printed no balances. That is unverifiable, not fine.",
    tone: "unknown",
  };
}
