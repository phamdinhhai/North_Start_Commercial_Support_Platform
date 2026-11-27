import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {OfflineSendJournal} from './offline-send-journal';

const fixture = () => { const dir=mkdtempSync(join(tmpdir(),'north-r4133-send-')); writeFileSync(join(dir,'.offline-send-fixture'),'fixture'); return dir; };
const binding = {fixture:true as const,workspaceId:'fixture-workspace',connectionId:'fixture-connection',operationId:'fixture-operation',pageId:'fixture-page',conversationId:'fixture-conversation'};
const key=Buffer.alloc(32,7);
const payload=Buffer.from('{"action":"reply_inbox","message":"fabricated"}');

describe('offline durable send journal', () => {
  it('writes planned/reserved before dispatch and requires explicit evidence to close', () => {
    const journalDir=fixture(),j=new OfflineSendJournal(journalDir,binding,key,payload); j.begin();
    expect(j.inspect()?.state).toBe('RESERVED');
    j.append('DISPATCH_STARTED'); j.append('AMBIGUOUS','transport failure'); j.release();
    const reopened=new OfflineSendJournal(journalDir,binding,key,payload);
    expect(reopened.inspect()?.state).toBe('AMBIGUOUS');
  });
  it('rejects duplicate operation and tampered append-only records', () => {
    const dir=fixture(),j=new OfflineSendJournal(dir,binding,key,payload);j.begin();j.release();
    expect(()=>new OfflineSendJournal(dir,binding,key,payload).begin()).toThrow('OFFLINE_SEND_OPERATION_EXISTS');
    expect(()=>new OfflineSendJournal(dir,binding,key,Buffer.from('changed')).inspect()).toThrow('OFFLINE_SEND_JOURNAL_CORRUPT');
  });
  it('requires fabricated fixture marker and strong key', () => {
    expect(()=>new OfflineSendJournal(fixture(),binding,Buffer.alloc(8),payload)).toThrow('OFFLINE_SEND_CONFIGURATION');
    expect(()=>new OfflineSendJournal(tmpdir(),binding,key,payload)).toThrow('OFFLINE_SEND_FIXTURE_REQUIRED');
  });
});
