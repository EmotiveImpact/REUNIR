import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './ui/button';

/** What a confirmation asks (decision 055). `confirmText` names the action, never a bare "OK". */
export type ConfirmRequest = { title: string; body?: string; confirmText: string; cancelText?: string };
type Pending = ConfirmRequest & { resolve: (ok: boolean) => void };
const ConfirmContext = createContext<((request: ConfirmRequest) => Promise<boolean>) | null>(null);

/**
 * The one confirmation box the app uses in place of the browser's own. It is a native modal dialog, like Modal, with the
 * alert dialogue role and shadcn slots. Cancel has focus first, so Enter or Escape never confirms by accident.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [pending, setPending] = useState<Pending | null>(null);
    const confirm = useCallback((request: ConfirmRequest) => new Promise<boolean>(resolve => {
        setPending(prior => { prior?.resolve(false); return { ...request, resolve }; });
    }), []);
    const answer = (ok: boolean) => { pending?.resolve(ok); setPending(null); };
    return <ConfirmContext.Provider value={confirm}>{children}{pending && <ConfirmDialog request={pending} onAnswer={answer}/>}</ConfirmContext.Provider>;
}

function ConfirmDialog({ request, onAnswer }: { request: ConfirmRequest; onAnswer: (ok: boolean) => void }) {
    const ref = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
    useEffect(() => { const d = ref.current; const prior = document.activeElement as HTMLElement; d?.showModal(); cancel.current?.focus(); return () => { d?.close(); prior?.focus?.(); }; }, []);
    return <dialog ref={ref} role="alertdialog" data-slot="alert-dialog-content" className="modal confirm-dialog" aria-labelledby="confirm-title" aria-describedby={request.body ? 'confirm-body' : undefined} onCancel={e => { e.preventDefault(); onAnswer(false); }}>
        <div data-slot="alert-dialog-header"><h2 id="confirm-title" data-slot="alert-dialog-title">{request.title}</h2>{request.body && <p id="confirm-body" data-slot="alert-dialog-description">{request.body}</p>}</div>
        <div className="confirm-actions" data-slot="alert-dialog-footer"><Button ref={cancel} type="button" variant="secondary" className="button secondary" onClick={() => onAnswer(false)}>{request.cancelText ?? 'Cancel'}</Button><Button type="button" variant="default" className="button primary" onClick={() => onAnswer(true)}>{request.confirmText}</Button></div>
    </dialog>;
}

/** Outside the provider (static rendering in tests) nothing can be confirmed, so every request is refused. */
const refuse = async () => false;
/** `if (await confirm({ title, confirmText })) …` resolves false when cancelled, dismissed with Escape, or replaced. */
export function useConfirm() {
    return useContext(ConfirmContext) ?? refuse;
}
