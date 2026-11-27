import type {ProviderServicePrincipal} from './provider-credentials';
import type {SourceObservation} from './source-observation';
/** Offline fabricated protocol only; not a provider webhook authentication contract. */
export interface FabricatedDelivery {
 readonly deliveryId:string;readonly observations:readonly SourceObservation[];
}
export interface FabricatedDeliveryResult {readonly classification:'TEST_ONLY';readonly deliveryId:string;readonly duplicate:boolean;readonly accepted:number;}
export interface FabricatedDeliveryStore {
 accept(principal:ProviderServicePrincipal,delivery:FabricatedDelivery):Promise<FabricatedDeliveryResult>;
}
