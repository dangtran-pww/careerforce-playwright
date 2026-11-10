import { Fragment, type ReactNode } from 'react';

export type Fact = readonly [label: string, value: ReactNode];

// A list of facts as [label, value] pairs. Falsy entries are skipped, so
// `cond && ['Label', value]` adds a fact only when it applies.
export function Facts({
  items,
}: {
  items: (Fact | false | '' | null | undefined)[];
}) {
  return (
    <dl className="facts">
      {items.filter(Boolean).map((fact) => {
        const [label, value] = fact as Fact;
        return (
          <Fragment key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </Fragment>
        );
      })}
    </dl>
  );
}
