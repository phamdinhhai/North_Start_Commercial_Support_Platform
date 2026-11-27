import type {SyncObservationAdmission} from '../../ports/durable-sync';
import {validateSourceObservation} from '../source-integration/validation';
import {assertSyntheticSourceAdmission} from '../source-trust/source-trust';
/** R4.11 validators reused at the application boundary, never a live provider assertion. */
export const admitSyncObservation:SyncObservationAdmission=(value,workspaceId,connection)=>{
 const observation=validateSourceObservation(value);
 assertSyntheticSourceAdmission(observation,{workspaceId,connection});
 return observation;
};
