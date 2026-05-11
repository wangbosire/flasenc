/**
 * HTTP API 规范中的**成功**顶层 JSON 形状（供子应用与测试引用类型，与运行时拦截器输出一致）。
 */
export type ApiSuccessEnvelope<T> = {
  success: true;
  data: T;
  traceId: string;
};

/**
 * **失败**顶层 JSON：`error` 内为业务码 + 文案 + 任意结构化 **`details`**（如 Zod `fields`）。
 */
export type ApiFailureEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
  traceId: string;
};
