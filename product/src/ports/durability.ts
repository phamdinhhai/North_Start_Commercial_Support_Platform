export interface DurabilityPort {
  readonly durable: boolean;
}

export const DURABILITY = Symbol('DURABILITY');
