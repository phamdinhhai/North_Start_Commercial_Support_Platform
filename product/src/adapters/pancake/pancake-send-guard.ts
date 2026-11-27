/**
 * Local single-send guard for a future trusted executor. It is deliberately
 * provider-independent: Pancake idempotency support is not established here.
 * An ambiguous result is terminal so callers must read back before review.
 */
export type PancakeSendState = 'reserved' | 'accepted' | 'rejected' | 'ambiguous';
export interface PancakeSendReservation { readonly key: string; readonly target: string; readonly state: PancakeSendState; }
const deny = (): never => { throw new Error('PANCAKE_SEND_GUARD_DENIED'); };
const ref = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 256 && !/[\r\n]/u.test(v);

export class PancakeSendGuard {
  private reservation: PancakeSendReservation | undefined;
  reserve(key: string, targetReference: string): PancakeSendReservation {
    if (!ref(key) || !ref(targetReference) || this.reservation) deny();
    this.reservation = Object.freeze({key, target: targetReference, state: 'reserved'});
    return this.reservation;
  }
  observe(key: string, result: 'accepted' | 'rejected' | 'ambiguous', targetReference: string): PancakeSendReservation {
    const reservation = this.reservation;
    if (!reservation || key !== reservation.key || targetReference !== reservation.target ||
        reservation.state !== 'reserved') return deny();
    this.reservation = Object.freeze({...reservation, state: result});
    return this.reservation;
  }
  get current(): PancakeSendReservation | undefined { return this.reservation; }
}
