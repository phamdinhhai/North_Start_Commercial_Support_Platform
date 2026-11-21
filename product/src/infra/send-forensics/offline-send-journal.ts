import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
import {appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync, fsyncSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {SendLedger, type SendEvent, type SendRecord, type SendState} from '../../domain/send-ledger/send-ledger';

export interface OfflineSendBinding {
  readonly fixture: true;
  readonly workspaceId: string;
  readonly connectionId: string;
  readonly operationId: string;
  readonly pageId: string;
  readonly conversationId: string;
}
interface Row {sequence: number; bindingDigest: string; event: SendEvent; previous: string; mac: string;}
const reject = (code: string): never => {throw new Error(code);};
const valid = (value: unknown): value is string => typeof value === 'string' && value.length > 0 &&
  value.length <= 256 && !/[\x00-\x20\x7f]/u.test(value);

/** Fabricated-data journal only. Not registered in runtime or a provider credential backend. */
export class OfflineSendJournal {
  private readonly key: Buffer;
  private readonly file: string;
  private readonly lock: string;
  private readonly digest: string;
  private readonly operationId: string;
  private held: number | undefined;
  constructor(directory: string, binding: OfflineSendBinding, key: Buffer, payload: Buffer) {
    if (!binding || binding.fixture !== true ||
      !['workspaceId','connectionId','operationId','pageId','conversationId'].every(k => valid(binding[k as keyof OfflineSendBinding])) ||
      !Buffer.isBuffer(key) || key.length < 32 || !Buffer.isBuffer(payload) || payload.length<1 || payload.length>8192) reject('OFFLINE_SEND_CONFIGURATION');
    this.key = Buffer.from(key);
    this.operationId = binding.operationId;
    const base = resolve(directory);
    // The caller must create this sentinel in a disposable fixture directory.
    if (!existsSync(join(base, '.offline-send-fixture'))) reject('OFFLINE_SEND_FIXTURE_REQUIRED');
    mkdirSync(base, {recursive: true});
    const id = createHash('sha256').update(JSON.stringify([binding.workspaceId,binding.connectionId,binding.operationId])).digest('hex');
    this.file = join(base,id+'.jsonl'); this.lock = join(base,id+'.lock');
    this.digest = createHmac('sha256',this.key).update(JSON.stringify([
      binding.fixture,binding.workspaceId,binding.connectionId,binding.operationId,binding.pageId,binding.conversationId,
    ])).update(payload).digest('hex');
  }
  private signature(value: Omit<Row,'mac'>): string {
    return createHmac('sha256',this.key).update(JSON.stringify(value)).digest('hex');
  }
  private rows(): Row[] {
    if (!existsSync(this.file)) return [];
    const text = readFileSync(this.file,'utf8');
    if (!text.endsWith('\n')) return reject('OFFLINE_SEND_JOURNAL_CORRUPT');
    let rows: Row[];
    try { rows = text.trimEnd().split('\n').map(line => JSON.parse(line) as Row); }
    catch { return reject('OFFLINE_SEND_JOURNAL_CORRUPT'); }
    let previous = '';
    for (const [index,row] of rows.entries()) {
      if (!row || row.sequence !== index+1 || row.bindingDigest !== this.digest || row.previous !== previous ||
        row.event?.requestId !== this.operationId || !/^[a-f0-9]{64}$/u.test(row.mac)) return reject('OFFLINE_SEND_JOURNAL_CORRUPT');
      const {mac,...body} = row;
      const expected = this.signature(body);
      if (!timingSafeEqual(Buffer.from(mac,'hex'),Buffer.from(expected,'hex'))) return reject('OFFLINE_SEND_JOURNAL_CORRUPT');
      previous = mac;
    }
    try { new SendLedger(rows.map(r=>r.event)); } catch { return reject('OFFLINE_SEND_JOURNAL_CORRUPT'); }
    return rows;
  }
  inspect(): SendRecord | undefined {
    const rows = this.rows();
    return rows.length ? new SendLedger(rows.map(r=>r.event)).get(this.operationId) : undefined;
  }
  /** A second caller/instance cannot pass this exclusive boundary. Stale locks are never deleted automatically. */
  begin(): void {
    if (this.held !== undefined) return reject('OFFLINE_SEND_ALREADY_HELD');
    try { this.held = openSync(this.lock,'wx',0o600); }
    catch { return reject('OFFLINE_SEND_LOCKED'); }
    try {
      if (this.rows().length) return reject('OFFLINE_SEND_OPERATION_EXISTS');
      writeSync(this.held,JSON.stringify({owner:process.pid})); fsyncSync(this.held);
      this.append('PLANNED'); this.append('RESERVED');
    } catch (error) { this.release(); throw error; }
  }
  append(state: SendState, evidence?: string): SendRecord {
    if (this.held === undefined) return reject('OFFLINE_SEND_NOT_HELD');
    const rows = this.rows(); const ledger = new SendLedger(rows.map(r=>r.event));
    const event: SendEvent = {requestId:this.operationId,event:state,at:new Date().toISOString(),...(evidence ? {evidence}: {})};
    const record = ledger.append(event);
    const body = {sequence:rows.length+1,bindingDigest:this.digest,event,previous:rows.at(-1)?.mac ?? ''};
    const row: Row = {...body,mac:this.signature(body)};
    // Append + fsync completes before dispatch. A torn line fails closed on recovery.
    const fd = openSync(this.file,'a',0o600);
    try { appendFileSync(fd,JSON.stringify(row)+'\n','utf8'); fsyncSync(fd); }
    finally { closeSync(fd); }
    return record;
  }
  release(): void {
    if (this.held === undefined) return;
    closeSync(this.held); this.held = undefined; unlinkSync(this.lock);
  }
}
