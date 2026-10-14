export interface ApiConfig {
  url: string;
  password: string;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  unauthorized: 'Falsches Haushalts-Passwort.',
  no_password: 'Im Google-Script ist noch kein PASSWORT hinterlegt (Projekteinstellungen → Script-Properties).',
  network: 'Keine Verbindung zum Google-Script. Seid ihr online, und ist die Web-App für „Jeder“ freigegeben?',
  bad_response: 'Das Google-Script antwortet nicht wie erwartet. Ist die URL die der Web-App (endet auf /exec)?',
  bad_url: 'Ungültiger Link.',
  bad_type: 'Dateityp wird nicht unterstützt.',
  too_large: 'Die Datei ist zu groß.',
};

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

export async function callApi<T = Record<string, unknown>>(cfg: ApiConfig, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    // text/plain keeps this a "simple" request (no CORS preflight, which Apps Script can't answer)
    res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, password: cfg.password }),
      redirect: 'follow',
    });
  } catch {
    throw new ApiError('network', MESSAGES.network);
  }
  const text = await res.text();
  let json: { ok?: boolean; error?: string; message?: string } & Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError('bad_response', MESSAGES.bad_response);
  }
  if (!json.ok) {
    const code = json.error ?? 'unknown';
    throw new ApiError(code, MESSAGES[code] ?? `Fehler im Google-Script: ${json.message ?? code}`);
  }
  return json as T;
}

export function isConfigured(cfg: ApiConfig | null): cfg is ApiConfig {
  return !!cfg && /^https:\/\/script\.google(usercontent)?\.com\//.test(cfg.url) && !!cfg.password;
}
