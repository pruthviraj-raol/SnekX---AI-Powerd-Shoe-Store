type JsonValue = Record<string, unknown> | unknown[];

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type ApiRequestOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: BodyInit | JsonValue | null;
  headers?: HeadersInit;
  token?: string | null;
};

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const resolveApiUrl = (path: string) => {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};

const isJsonPayload = (body: ApiRequestOptions["body"]) => {
  if (!body) {
    return false;
  }

  return (
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer)
  );
};

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

export const apiRequest = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  const { body, headers, token, ...rest } = options;
  const requestHeaders = new Headers(headers);

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const requestBody: BodyInit | undefined = isJsonPayload(body)
    ? JSON.stringify(body)
    : (body ?? undefined) as BodyInit | undefined;

  if (isJsonPayload(body) && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(resolveApiUrl(path), {
    ...rest,
    body: requestBody,
    headers: requestHeaders,
  });

  const responseType = response.headers.get("content-type") || "";
  const responseData = responseType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof responseData === "object" &&
      responseData !== null &&
      "message" in responseData &&
      typeof responseData.message === "string"
        ? responseData.message
        : `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, responseData);
  }

  return responseData as T;
};
