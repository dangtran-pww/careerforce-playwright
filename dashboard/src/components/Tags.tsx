// A test's Playwright tags as small pills, e.g. @desktop-only. Tags in
// TAG_NOTES get a tooltip saying what they do. Renders nothing without tags.
const TAG_NOTES: Record<string, string> = {
  'desktop-only': 'Skipped by the mobile projects',
  'mobile-only': 'Runs only in the mobile projects',
  'job-search': 'Run by the job-search project',
  'no-prod': 'Never runs on Production',
};

export function Tags({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <span className="tags">
      {tags.map((t) => (
        <span key={t} className="tag" title={TAG_NOTES[t]}>
          @{t}
        </span>
      ))}
    </span>
  );
}
