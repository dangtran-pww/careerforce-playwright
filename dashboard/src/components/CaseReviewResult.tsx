import type {
  CaseReview,
  ReviewFindingKind,
  ReviewVerdict,
} from '../api/types';
import { ClaudeUsageNote } from './ClaudeUsageNote';
import { InfoTip } from './InfoTip';

// `about` says what each one means, for the "How the review works" tip
// (ReviewHelp).
const VERDICT: Record<
  ReviewVerdict,
  { label: string; tone: string; about: string }
> = {
  matches: {
    label: 'Code matches the plan',
    tone: 'good',
    about: 'every step and expected result is tested.',
  },
  partial: {
    label: 'Code partly matches the plan',
    tone: 'warn',
    about: 'most are tested, with some gaps or differences.',
  },
  differs: {
    label: 'Code differs from the plan',
    tone: 'bad',
    about: "the code doesn't test what the plan describes.",
  },
};

// Most important first.
const KINDS: { kind: ReviewFindingKind; label: string; about: string }[] = [
  {
    kind: 'missing',
    label: 'In the plan, not tested',
    about: 'a step or check the code leaves out.',
  },
  {
    kind: 'different',
    label: 'Tested differently',
    about:
      'done another way or checked more weakly, e.g. a link exists but is not followed.',
  },
  {
    kind: 'extra',
    label: 'Tested, not in the plan',
    about: "checks the code makes that the plan doesn't mention.",
  },
  {
    kind: 'covered',
    label: 'Covered',
    about: 'plan steps and checks the code does test.',
  },
];

// Claude's review of a case's code against its plan row, shown under
// "What the code does". Kept in the server's memory only.
export function CaseReviewResult({ review }: { review: CaseReview }) {
  const verdict = VERDICT[review.verdict];
  return (
    <div className="case-review" aria-label="Review against the plan">
      <div className="case-review-head">
        <h5 className={`case-review-verdict tone-${verdict.tone}`}>
          {verdict.label}
        </h5>
        <InfoTip label="How the review works" align="start">
          <ReviewHelp />
        </InfoTip>
      </div>
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

// What a review shows, in the order it shows it, with the same labels: for
// the "How the review works" tip next to the Review button.
export function ReviewHelp() {
  return (
    <>
      <p>
        Claude reads this case's row in the plan and the test code behind it,
        including the helpers and page objects it uses, and compares the two.
        It only reads: it doesn't run the test or open the site, so a match
        doesn't mean the test passes.
      </p>
      <p className="info-tip-heading">The result shows:</p>
      <ol className="info-tip-list">
        <li>
          <strong>A verdict</strong>
          <ul>
            {Object.values(VERDICT).map((v) => (
              <li key={v.label}>
                <span className={`case-review-verdict tone-${v.tone}`}>{v.label}</span>:{' '}
                {v.about}
              </li>
            ))}
          </ul>
        </li>
        <li>
          <strong>A summary</strong> in a sentence or two.
        </li>
        <li>
          <strong>Findings</strong>, grouped and most important first (empty
          groups are left out):
          <ul>
            {KINDS.map((k) => (
              <li key={k.kind}>
                <em>{k.label}</em>: {k.about}
              </li>
            ))}
          </ul>
        </li>
        <li>
          <strong>The model, tokens and cost</strong> of the review.
        </li>
      </ol>
      <p>
        The review is kept until the dashboard restarts, and marked out of date
        if the test file changes. Each click asks Claude again (about a
        minute).
      </p>
    </>
  );
}
