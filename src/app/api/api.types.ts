export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: any };
export type ApiResult<T> = ApiOk<T> | ApiErr;

export type ToProccessBody = {
  tx: number;
  // Backend accepts: string | number | object (non-array), and also allows null/undefined.
  params: object | string | number | null | undefined;
};
