import dotenv from 'dotenv';

dotenv.config();

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  supabaseUrl: getEnv('https://etufowqjyrywdisxfrgl.supabase.co'),
  supabaseServiceRoleKey: getEnv('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dWZvd3FqeXJ5d2Rpc3hmcmdsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc1MzczNSwiZXhwIjoyMDg4MzI5NzM1fQ.3FE5QmFQI2x5IQAeJiC6XT7A4v6psaKdloK0ezdtCRA'),
};
