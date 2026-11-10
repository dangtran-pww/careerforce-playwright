import { Fragment, type ReactNode } from 'react';

export type Fact = readonly [label: string, value: ReactNode];

// A list of facts as [label, value] pairs. Falsy entries are skipped, so
// `cond && ['Label', value]` adds a fact only when it applies.
export function Facts({
  items,
  plain = false,
}: {
  items: (Fact | false | '' | null | undefined)[];
  plain?: boolean;
}) {
  return (
    <dl className={plain ? 'facts facts-plain' : 'facts'}>
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
