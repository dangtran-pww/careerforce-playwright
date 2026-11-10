import type { ReactNode } from 'react';
import { Link } from 'react-router';

// "← Test plans" at the top of a detail page.
export function BackLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <p className="crumbs">
      <Link to={to}>{children}</Link>
    </p>
  );
}

// A page heading with tags beside it.
export function TitleRow({
  title,
  children,
}: {
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="title-row">
      <h1>{title}</h1>
      {children}
    </div>
  );
}
