import { Fragment, useState, type ReactNode } from 'react';

export interface Column<T> {
  head: ReactNode;
  cell: (row: T) => ReactNode;
  // The cell's class, or a function of the row.
  className?: string | ((row: T) => string | undefined);
  // Hide the column on phones (560px and under); show its value somewhere
  // else in the row with a `narrow-only` element.
  wideOnly?: boolean;
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
// A click anywhere else on the row does the same, except on its own controls
// (links, buttons, inputs) or when the click ends a text selection.
// `expandLabel` names the button for screen readers.
//
// With `below`, each row it returns content for gets that content, always
// shown, in a row underneath. It starts at column `belowFrom` (0 = the first
// column) and spans the rest, so it can line up under, e.g., the Test column.
export function Table<T>({
  columns,
  rows,
  rowKey,
  expand,
  expandLabel = () => 'Details',
  below,
  belowFrom = 0,
}: {
  columns: (Column<T> | false | null | undefined)[];
  rows: T[];
  rowKey: (row: T) => string;
  expand?: (row: T) => ReactNode;
  expandLabel?: (row: T) => string;
  below?: (row: T) => ReactNode;
  belowFrom?: number;
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
  const wide = (col: Column<T>) => (col.wideOnly ? 'wide-only' : undefined);
  const cellClass = (col: Column<T>, row: T) =>
    [
      typeof col.className === 'function' ? col.className(row) : col.className,
      wide(col),
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {cols.map((col, i) => (
              <th key={i} className={wide(col)}>
                {col.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const details = expand && open.has(key) && expand(row);
            const extra = below?.(row);
            // Columns before `belowFrom`, counting the expand toggle.
            const lead = belowFrom + (expand ? 1 : 0);
            const expandable = Boolean(expand?.(row));
            const rowClass = [
              expandable && 'row-expandable',
              (details || extra) && 'row-open',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <Fragment key={key}>
                <tr
                  className={rowClass || undefined}
                  onClick={
                    expandable
                      ? (e) => {
                          if (isOwnControl(e.target, e.currentTarget)) return;
                          if (window.getSelection()?.toString()) return;
                          toggle(key);
                        }
                      : undefined
                  }
                >
                  {cols.map((col, i) => (
                    <td key={i} className={cellClass(col, row)}>
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
                {extra && (
                  <tr className={details ? 'row-below row-open' : 'row-below'}>
                    {lead > 0 && <td className="below-lead" colSpan={lead} />}
                    <td colSpan={cols.length - lead}>{extra}</td>
                  </tr>
                )}
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

// Whether a click landed on a control inside the row (the toggle, a
// checkbox, a Run button, a link), which handles the click itself.
function isOwnControl(target: EventTarget, row: Element) {
  const control =
    target instanceof Element &&
    target.closest('a, button, input, select, textarea, label, summary');
  return Boolean(control && row.contains(control));
}

// Text only screen readers read, e.g. an "Actions" column heading.
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="visually-hidden">{children}</span>;
}
