import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, TriangleAlert, X } from 'lucide-react';
import { MapWarningsContext } from './MapWarningsContext';
import './SourceWarning.css';

export type WarningDetail = { name: string; message: string };

export default function WarningNotice({ title, message, details, onRetry, retryLabel = 'Retry', onDismiss,
  dismissLabel = 'Dismiss warning', ariaLabel = title, role = 'alert', inline = false,
}: {
  title: string; message?: string; details?: WarningDetail[]; onRetry?: () => void; retryLabel?: string;
  onDismiss?: () => void; dismissLabel?: string; ariaLabel?: string; role?: 'alert' | 'status'; inline?: boolean;
}) {
  const context = useContext(MapWarningsContext);
  const card = <section className={`source-warning ${!context && !inline ? 'map-warning-inline' : ''}`} role={role} aria-label={ariaLabel}>
    <TriangleAlert className="source-warning-icon" size={18} aria-hidden="true" />
    <div className="source-warning-content">
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {!!details?.length && <details><summary>Details</summary>
        <ul>{details.map((detail, index) => <li key={`${detail.name}-${index}`}><strong>{detail.name}:</strong> {detail.message}</li>)}</ul>
      </details>}
    </div>
    {(onRetry || onDismiss) && <div className="source-warning-actions">
      {onRetry && <button className="source-warning-retry" aria-label={retryLabel} onClick={onRetry}>
        <RefreshCw size={13} aria-hidden="true" />Retry
      </button>}
      {onDismiss && <button className="source-warning-dismiss" aria-label={dismissLabel} onClick={onDismiss}><X size={15} aria-hidden="true" /></button>}
    </div>}
  </section>;
  if (inline || !context) return card;
  return context.host ? createPortal(card, context.host) : null;
}
