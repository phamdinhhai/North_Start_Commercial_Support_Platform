import type { PancakeReadRequest, PancakeTransport, PancakeTransportResponse } from './pancake.types';

export type MockResponse = PancakeTransportResponse | Error;

/** Deterministic test transport; no credentials, network, or private endpoint. */
export class MockPancakeTransport implements PancakeTransport {
  readonly requests: PancakeReadRequest[] = [];
  private index = 0;

  constructor(private readonly responses: readonly MockResponse[]) {}

  async readPage(request: PancakeReadRequest): Promise<PancakeTransportResponse> {
    this.requests.push(request);
    const response = this.responses[Math.min(this.index++, this.responses.length - 1)];
    if (response instanceof Error) throw response;
    return response ?? { status: 200, page: { records: [], nextCursor: null } };
  }
}
