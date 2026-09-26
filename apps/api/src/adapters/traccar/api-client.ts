/** Dispositivo según la API REST de Traccar (solo dentro de adapters/, principio I). */
export type TraccarDevice = {
  id: number;
  uniqueId: string;
  name: string;
  lastUpdate: string | null;
  status?: string;
};

export interface TraccarApi {
  createDevice(uniqueId: string, name: string): Promise<void>;
  listDevices(): Promise<TraccarDevice[]>;
}

/** Cliente REST de Traccar con el usuario de servicio. */
export class TraccarApiClient implements TraccarApi {
  constructor(
    private readonly baseUrl: string,
    private readonly user: string,
    private readonly password: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private headers() {
    const auth = Buffer.from(`${this.user}:${this.password}`).toString('base64');
    return { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };
  }

  async createDevice(uniqueId: string, name: string) {
    const res = await this.fetchFn(`${this.baseUrl}/api/devices`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ uniqueId, name }),
    });
    // Si ya existe (p. ej. se registró como desconocido en desarrollo), no es error.
    if (!res.ok && res.status !== 400) throw new Error(`Traccar respondió ${res.status}`);
  }

  async listDevices(): Promise<TraccarDevice[]> {
    const res = await this.fetchFn(`${this.baseUrl}/api/devices?all=true`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Traccar respondió ${res.status}`);
    return (await res.json()) as TraccarDevice[];
  }
}

export class FakeTraccarApi implements TraccarApi {
  readonly devices = new Map<string, TraccarDevice>();
  private nextId = 1;

  async createDevice(uniqueId: string, name: string) {
    if (!this.devices.has(uniqueId)) {
      this.devices.set(uniqueId, { id: this.nextId++, uniqueId, name, lastUpdate: null });
    }
  }

  async listDevices() {
    return [...this.devices.values()];
  }

  touch(uniqueId: string, at: Date) {
    const d = this.devices.get(uniqueId);
    if (d) d.lastUpdate = at.toISOString();
  }
}
