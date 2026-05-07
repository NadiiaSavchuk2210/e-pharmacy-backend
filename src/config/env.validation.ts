const requiredEnvVariables = ['MONGODB_URI', 'AUTH_TOKEN_SECRET'] as const;
const DEFAULT_PORT = '3000';
const DEFAULT_AUTH_TOKEN_TTL_SECONDS = '86400';

export function validateEnv(config: Record<string, unknown>) {
  const missingVariables = requiredEnvVariables.filter((key) => !config[key]);

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(', ')}`,
    );
  }

  const normalizedConfig = {
    ...config,
    PORT: normalizePort(config.PORT),
    AUTH_TOKEN_TTL: normalizePositiveInteger(
      config.AUTH_TOKEN_TTL,
      DEFAULT_AUTH_TOKEN_TTL_SECONDS,
      'AUTH_TOKEN_TTL',
    ),
  };

  return normalizedConfig;
}

function normalizePort(value: unknown): string {
  const port = normalizePositiveInteger(value, DEFAULT_PORT, 'PORT');
  const parsedPort = Number.parseInt(port, 10);

  if (parsedPort > 65535) {
    throw new Error('PORT must be less than or equal to 65535');
  }

  return port;
}

function normalizePositiveInteger(
  value: unknown,
  defaultValue: string,
  key: string,
): string {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const stringValue =
    typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : defaultValue;
  const parsedValue = Number.parseInt(stringValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }

  return String(parsedValue);
}
