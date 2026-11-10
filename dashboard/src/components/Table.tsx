import { Fragment, useState, type ReactNode } from 'react';

export interface Column<T> {
  head: ReactNode;
  cell: (row: T) => ReactNode;
  // The cell's class, or a function of the row.
  className?: string | ((row: T) => string | undefined);
}

// A data table, described by its columns:
//
//   <Table
//     rows={runs}
//     rowKey={(run) => run.id}
//     columns={[
//       { head: 'Started', cell: (run) => <TimeAgo iso={run.startedAt} /> },
//       showEnv && { head: 'Env', cell: (run) => <EnvTag env={run.env} /> },
//     ]}
//   />
//
// Falsy columns are skipped, so `cond && { … }` adds a column only when it
// applies.
//
// With `expand`, each row it returns content for gets a ▸ button in a first
// column; the button shows that content in a full-width row underneath.
// `expandLabel` names the button for screen readers.
export function Table<T>({
  columns,
  rows,
  rowKey,
  expand,
  expandLabel = () => 'Details',
}: {
  columns: (Column<T> | false | null | undefined)[];
  rows: T[];
  rowKey: (row: T) => string;
  expand?: (row: T) => ReactNode;
  expandLabel?: (row: T) => string;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const cols = [
    expand && {
      head: <VisuallyHidden>Details</VisuallyHidden>,
      className: 'cell-toggle',
      cell: (row: T) => {
        const key = rowKey(row);
        if (!expand(row)) return null;
        const isOpen = open.has(key);
        return (
          <button
            type="button"
            className="row-toggle"
            aria-expanded={isOpen}
            aria-controls={`row-details-${key}`}
            aria-label={expandLabel(row)}
            title={isOpen ? 'Hide details' : 'Show details'}
            onClick={() => toggle(key)}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        );
      },
    },
    ...columns,
  ].filter(Boolean) as Column<T>[];
  const cellClass = (col: Column<T>, row: T) =>
    typeof col.className === 'function' ? col.className(row) : col.className;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {cols.map((col, i) => (
              <th key={i}>{col.head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const details = expand && open.has(key) && expand(row);
            return (
              <Fragment key={key}>
                <tr className={details ? 'row-open' : undefined}>
                  {cols.map((col, i) => (
                    <td key={i} className={cellClass(col, row)}>
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
                {details && (
                  <tr className="row-details" id={`row-details-${key}`}>
                    <td colSpan={cols.length}>{details}</td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Text only screen readers read, e.g. an "Actions" column heading.
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="visually-hidden">{children}</span>;
}
