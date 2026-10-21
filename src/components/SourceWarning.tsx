import WarningNotice from './WarningNotice';

export type SourceIssue = { name: string; message: string };

export default function SourceWarning({ issues, onRetry }: { issues: SourceIssue[]; onRetry: () => void }) {
  if (!issues.length) return null;
  const names = [...new Set(issues.map(issue => issue.name))];
  return <WarningNotice title="Some sources unavailable" ariaLabel="Source availability warning"
    message={`${names.slice(0, 2).join(' · ')}${names.length > 2 ? ` + ${names.length - 2} more` : ''}`}
    details={issues} onRetry={onRetry} retryLabel="Retry sources" />;
}
