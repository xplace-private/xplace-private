type GatewaySuccess<Data> = [Data] extends [void]
  ? { ok: true }
  : { ok: true; data: Data }

export type GatewayResult<Data = void> =
  | GatewaySuccess<Data>
  | { ok: false; code: string; message: string }
