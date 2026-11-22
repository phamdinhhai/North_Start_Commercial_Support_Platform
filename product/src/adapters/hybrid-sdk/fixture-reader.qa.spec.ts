import {expect,it} from 'vitest';
import {ConfiguredHybridFixtureReader} from './fixture-reader';
import type {IntegrationScope} from '../../ports/integration';
const scope:IntegrationScope={workspaceId:'fixture-workspace',connectionId:'fixture-connection',accountId:'fixture-account',providerSurface:'pancake-conversations',pageId:'fixture-page',target:{pageId:'fixture-page',conversationId:'fixture-conversation'}};
const config={workspaceId:scope.workspaceId,connectionId:scope.connectionId,accountId:scope.accountId,baseUrl:'http://127.0.0.1:1',accessToken:'pancake-fixture',expiresAt:'2099-01-01T00:00:00Z'};
it('rejects expired configured credentials before dispatch',async()=>{const reader=new ConfiguredHybridFixtureReader(JSON.stringify([{...config,expiresAt:'2000-01-01T00:00:00Z'}]));await expect(reader.read(scope)).rejects.toThrow('CREDENTIAL_UNAVAILABLE');});
it('rejects revoked credentials before dispatch',async()=>{const reader=new ConfiguredHybridFixtureReader(JSON.stringify([config]));reader.revoke(scope.workspaceId,scope.connectionId);await expect(reader.read(scope)).rejects.toThrow('CREDENTIAL_UNAVAILABLE');});
it('does not select a credential for another workspace, connection or account',async()=>{const reader=new ConfiguredHybridFixtureReader(JSON.stringify([config]));for(const patch of [{workspaceId:'foreign'},{connectionId:'foreign'},{accountId:'foreign'}])await expect(reader.read({...scope,...patch})).rejects.toThrow('CREDENTIAL_UNAVAILABLE');});
