import test from 'node:test';import assert from 'node:assert/strict';
import {validateRootDatabase,fixtureDatabaseName} from './durable-e2e-policy.mjs';
test('combined browser rehearsal requires explicit isolated loopback database and no application database',()=>{
 assert.equal(validateRootDatabase('postgres://fixture@127.0.0.1:5434/north_start_ci').hostname,'127.0.0.1');
 for(const value of ['postgres://fixture@remote.example:5432/north_start_ci','postgres://fixture@127.0.0.1/north_start_ci','https://127.0.0.1:5432/db','postgres://fixture@127.0.0.1:5432/db?x=1'])assert.throws(()=>validateRootDatabase(value));
 assert.throws(()=>validateRootDatabase('postgres://fixture@127.0.0.1:5432/db','postgres://application'));
});
test('cleanup database identifiers cannot escape generated task namespace',()=>{assert.equal(fixtureDatabaseName('qa_browser_r414_123456abcd'),'qa_browser_r414_123456abcd');for(const value of ['postgres','qa_browser_r414_x','qa_browser_r414_123456abcd;DROP DATABASE main'])assert.throws(()=>fixtureDatabaseName(value));});
