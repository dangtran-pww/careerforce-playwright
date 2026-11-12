import { Link } from 'react-router';

// Any route that isn't in App.tsx.
export function NotFoundPage() {
  return (
    <>
      <h1>Not found</h1>
      <p>
        <Link to="/suites">Back to the suites</Link>
      </p>
    </>
  );
}
