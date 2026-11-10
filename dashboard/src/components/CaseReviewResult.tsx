import type {
  CaseReview,
  ReviewFindingKind,
  ReviewVerdict,
} from '../api/types';
import { ClaudeUsageNote } from './ClaudeUsageNote';

const VERDICT: Record<ReviewVerdict, { label: string; tone: string }> = {
  matches: { label: 'Code matches the plan', tone: 'good' },
  partial: { label: 'Code partly matches the plan', tone: 'warn' },
  differs: { label: 'Code differs from the plan', tone: 'bad' },
};

// Most important first.
const KINDS: { kind: ReviewFindingKind; label: string }[] = [
  { kind: 'missing', label: 'In the plan, not tested' },
  { kind: 'different', label: 'Tested differently' },
  { kind: 'extra', label: 'Tested, not in the plan' },
  { kind: 'covered', label: 'Covered' },
];

// Claude's review of a case's code against its plan row, shown under
// "What the code does". Kept in the server's memory only.
export function CaseReviewResult({ review }: { review: CaseReview }) {
  const verdict = VERDICT[review.verdict];
  return (
    <div className="case-review" aria-label="Review against the plan">
      <h5 className={`case-review-verdict tone-${verdict.tone}`}>
        {verdict.label}
      </h5>
      {review.stale && (
        <p className="callout callout-warn">
          The test code changed after this review. Review again for an
          up-to-date one.
        </p>
      )}
      {review.summary && <p>{review.summary}</p>}
      {KINDS.map(({ kind, label }) => {
        const items = review.findings.filter((f) => f.kind === kind);
        if (!items.length) return null;
        return (
          <div key={kind} className={`case-review-group kind-${kind}`}>
            <h6>{label}</h6>
            <ul>
              {items.map((f, i) => (
                <li key={i}>{f.text}</li>
              ))}
            </ul>
          </div>
        );
      })}
      <ClaudeUsageNote usage={review} verb="Reviewed" />
    </div>
  );
}
