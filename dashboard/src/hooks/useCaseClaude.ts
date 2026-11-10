import { useEffect, useState } from 'react';
import { post } from '../api/client';
import type {
  CaseExplanation,
  CaseReview,
  ExplanationResponse,
  LatestReviewResponse,
  ReviewResponse,
} from '../api/types';
import { useApi } from './useApi';

// Claude's two answers about a case's test code, and the requests that ask
// for them again:
//
//   explanation: what the code does, step by step. Saved on disk.
//   review: the code against the plan's row for the case. Kept in the
//     server's memory only, so it survives leaving the page but not a
//     server restart; every request asks Claude again.
//
// Each takes about a minute. Used by the plan page's "What the code does"
// panel (CaseExplain) and the run page's side-by-side card (CaseCompare).
export function useCaseClaude(planSlug: string, caseId: string) {
  const path = `/api/plans/${planSlug}/cases/${caseId}/explanation`;
  const saved = useApi<ExplanationResponse>(path);
  const [fresh, setFresh] = useState<CaseExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const reviewPath = `/api/plans/${planSlug}/cases/${caseId}/review`;
  const lastReview = useApi<LatestReviewResponse>(reviewPath);
  const [freshReview, setFreshReview] = useState<CaseReview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function explain() {
    setExplaining(true);
    setExplainError(null);
    try {
      const refresh = Boolean(fresh ?? saved.data?.explanation);
      const res = await post<ExplanationResponse>(path, { refresh });
      setFresh(res.explanation);
    } catch (err) {
      setExplainError((err as Error).message);
    } finally {
      setExplaining(false);
    }
  }

  async function review() {
    setReviewing(true);
    setReviewError(null);
    try {
      const res = await post<ReviewResponse>(reviewPath);
      setFreshReview(res.review);
    } catch (err) {
      setReviewError((err as Error).message);
    } finally {
      setReviewing(false);
    }
  }

  // Came back while a review was still running: wait for that one. The
  // server joins this request to it rather than asking Claude again.
  const stillReviewing = lastReview.data?.reviewing ?? false;
  useEffect(() => {
    if (!stillReviewing) return;
    let cancelled = false;
    post<ReviewResponse>(reviewPath).then(
      (res) => !cancelled && setFreshReview(res.review),
      (err: Error) => !cancelled && setReviewError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [stillReviewing, reviewPath]);

  return {
    // Null until loaded, and when there is none yet.
    explanation: fresh ?? saved.data?.explanation ?? null,
    explanationLoading: saved.loading && !saved.data,
    explaining,
    explainError,
    explain,
    review: freshReview ?? lastReview.data?.review ?? null,
    reviewing: reviewing || (stillReviewing && !freshReview && !reviewError),
    reviewError,
    runReview: review,
  };
}
