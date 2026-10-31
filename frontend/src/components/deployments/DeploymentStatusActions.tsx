import { useEffect, useId, useRef, useState } from 'react';

import { allowedTransitions } from '../../api/deployments';
import type { DeploymentStatus } from '../../api/types';

const ACTION_LABELS: Record<Exclude<DeploymentStatus, 'pending'>, string> = {
  running: 'Start',
  succeeded: 'Mark succeeded',
  failed: 'Mark failed',
  rolled_back: 'Roll back',
};

interface DeploymentStatusActionsProps {
  status: DeploymentStatus;
  onTransition: (status: DeploymentStatus) => Promise<void>;
}

// WHY: one action component keeps list and details transitions and confirmation behavior consistent.
export function DeploymentStatusActions({ status, onTransition }: DeploymentStatusActionsProps) {
  const [confirmStatus, setConfirmStatus] = useState<DeploymentStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const requiresConfirmation = confirmStatus === 'failed' || confirmStatus === 'rolled_back';

  useEffect(() => {
    if (!confirmStatus) return undefined;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setConfirmStatus(null);
        triggerRef.current?.focus();
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled])',
        ));
        if (controls.length === 0) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirmStatus]);

  // WHY: mutations are serialized locally so repeated clicks cannot submit duplicate transitions.
  const submit = async (target: DeploymentStatus) => {
    if (busy) return;
    setBusy(true);
    try {
      await onTransition(target);
      setConfirmStatus(null);
      triggerRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {allowedTransitions(status).map(target => {
        const label = ACTION_LABELS[target as Exclude<DeploymentStatus, 'pending'>];
        return (
          <button
            key={target}
            type="button"
            disabled={busy}
            onClick={event => {
              if (target === 'failed' || target === 'rolled_back') {
                triggerRef.current = event.currentTarget;
                setConfirmStatus(target);
              }
              else void submit(target);
            }}
            className="rounded border border-outline-variant px-3 py-1 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
          >
            {label}
          </button>
        );
      })}
      {requiresConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="w-full max-w-md space-y-4 rounded-xl bg-surface-container-lowest p-6 shadow-xl"
          >
            <h2 id={titleId} className="font-headline-md text-headline-md">
              {ACTION_LABELS[confirmStatus]}
            </h2>
            <p>Are you sure you want to {ACTION_LABELS[confirmStatus].toLowerCase()} this deployment?</p>
            <div className="flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => {
                  setConfirmStatus(null);
                  triggerRef.current?.focus();
                }}
                className="rounded border border-outline-variant px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit(confirmStatus)}
                className="rounded bg-primary px-3 py-2 text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
