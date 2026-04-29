const requiredEnvVariables = ['MONGODB_URI', 'AUTH_TOKEN_SECRET'] as const;

export function validateEnv(config: Record<string, unknown>) {
  const missingVariables = requiredEnvVariables.filter((key) => !config[key]);

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(', ')}`,
    );
  }

  return config;
}
