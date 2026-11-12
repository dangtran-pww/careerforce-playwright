import { useEnv } from '../../hooks/useEnv';

// "Compare with": what the plan's prompt cases that compare sites compare
// the environment under test with. "default" is the environment's own
// comparison site (QA → Stage, Stage → Production, Production → its last
// run's screenshots).
export function CompareWith({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { currentEnv, environments, envById } = useEnv();
  const own = currentEnv.compareWith ?? 'baseline';
  const name = (id: string) =>
    id === 'baseline'
      ? `its last run on ${currentEnv.name} (baseline)`
      : (envById(id)?.name ?? id);
  const others = environments.filter((e) => e.id !== currentEnv.id);

  return (
    <label className="field">
      <span>Compare with</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="default">Default: {name(own)}</option>
        {others.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} ({e.baseURL})
          </option>
        ))}
        <option value="baseline">{name('baseline')}</option>
      </select>
    </label>
  );
}
