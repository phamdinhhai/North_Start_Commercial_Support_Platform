import { describe, expect, it } from 'vitest';
import { encodeEvidenceCursor, evidencePageRequest } from './evidence-cursor';
const id='00000000-0000-4000-8000-000000000001';
describe('source evidence keyset cursor',()=>{
  it('preserves PostgreSQL microseconds and binds position to workspace and lead',()=>{
    const position={time:'2026-11-20T01:02:03.123456Z',id};
    const cursor=encodeEvidenceCursor('workspace','lead',position);
    expect(evidencePageRequest('workspace','lead',{cursor,limit:3})).toEqual({limit:3,position});
    expect(()=>evidencePageRequest('foreign','lead',{cursor})).toThrow('INPUT_INVALID');
    expect(()=>evidencePageRequest('workspace','foreign',{cursor})).toThrow('INPUT_INVALID');
  });
  it('rejects invalid bounds, shapes, dates and noncanonical encodings before querying',()=>{
    expect(evidencePageRequest('w','l')).toEqual({limit:20,position:null});
    for(const options of [{limit:0},{limit:101},{limit:1.2},{cursor:'a'.repeat(2049)},{cursor:'!!!'},
      {cursor:encodeEvidenceCursor('w','l',{time:'2026-02-30T00:00:00.000000Z',id})},
      {cursor:encodeEvidenceCursor('w','l',{time:'2026-11-20T00:00:00.000000Z',id:'invalid'})},
      {cursor:Buffer.from('null').toString('base64url')}]) {
      expect(()=>evidencePageRequest('w','l',options)).toThrow('INPUT_INVALID');
    }
  });
});
