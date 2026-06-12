import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as net from 'net';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function logSuccess(message: string) {
  console.log(`${GREEN}✔${RESET} ${message}`);
}

function logFailure(message: string) {
  console.error(`${RED}✘${RESET} ${message}`);
}

function logWarning(message: string) {
  console.warn(`${YELLOW}⚠${RESET} ${message}`);
}

function logHeader(title: string) {
  console.log(`\n${BOLD}${BLUE}=== ${title} ===${RESET}`);
}

async function checkEnvironment() {
  logHeader('Environment Variables Diagnostics');
  const required = ['DATABASE_URL', 'APP_PASSWORD', 'NEXTAUTH_SECRET'];
  let missing = false;

  for (const envVar of required) {
    if (!process.env[envVar]) {
      logFailure(`Missing required environment variable: ${envVar}`);
      missing = true;
    } else {
      logSuccess(`Found environment variable: ${envVar}`);
    }
  }

  const optional = ['OPENAI_BASE_URL', 'OPENAI_API_KEY', 'AI_MODEL', 'OPENAI_CHAT_ID'];
  for (const envVar of optional) {
    if (!process.env[envVar]) {
      logWarning(`Optional environment variable not set: ${envVar}`);
    } else {
      logSuccess(`Found optional environment variable: ${envVar}`);
    }
  }

  if (missing) {
    throw new Error('Required environment variables are missing.');
  }
}

async function checkDatabase() {
  logHeader('Database Connection & Schema Diagnostics');
  const prisma = new PrismaClient();

  try {
    // Attempt basic query
    await prisma.$queryRaw`SELECT 1`;
    logSuccess('Successfully connected to the database.');

    // Query active settings or accounts to verify tables exist
    const settingsCount = await prisma.settings.count();
    logSuccess(`Database tables resolved. Settings record count: ${settingsCount}`);

    // Query SimpleFIN config status
    const settings = await prisma.settings.findFirst();
    if (settings?.simpleFinToken) {
      logSuccess('SimpleFIN token is configured in database.');
    } else {
      logWarning('SimpleFIN token is not configured in database Settings.');
    }
  } catch (error: unknown) {
    const err = error as Error;
    logFailure(`Database connection failed: ${err.message || String(error)}`);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function checkMigrations() {
  logHeader('Database Migration Diagnostics');
  try {
    const status = execSync('npx prisma migrate status', { stdio: 'pipe' }).toString();
    console.log(status.trim());
    if (status.includes('Database is up-to-date')) {
      logSuccess('Database migrations are fully synchronized and up-to-date.');
    } else {
      logWarning('Prisma migrate status reports potential drift or pending migrations.');
    }
  } catch (error: unknown) {
    const err = error as { message?: string; stderr?: Buffer };
    logFailure(`Could not execute migration check: ${err.message || String(error)}`);
    const stderr = err.stderr ? err.stderr.toString() : '';
    if (stderr) console.error(stderr);
    throw error;
  }
}

function checkPort(host: string, port: number, timeout: number = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      socket.destroy();
      if (!isResolved) {
        isResolved = true;
        resolve(true);
      }
    });

    const handleError = () => {
      socket.destroy();
      if (!isResolved) {
        isResolved = true;
        resolve(false);
      }
    };

    socket.on('error', handleError);
    socket.on('timeout', handleError);

    socket.connect(port, host);
  });
}

async function checkNetworkLoops() {
  logHeader('Local Port Reachability Diagnostics');
  
  // DB Port (Host: 5433 or Container: 5432)
  const isLocalDBOpen = await checkPort('localhost', 5433);
  const isDockerDBOpen = await checkPort('db', 5432);

  if (isLocalDBOpen) {
    logSuccess('PostgreSQL DB is reachable locally on port 5433.');
  } else if (isDockerDBOpen) {
    logSuccess('PostgreSQL DB is reachable inside the container network on port 5432.');
  } else {
    logWarning('PostgreSQL DB port is not directly reachable from this script.');
  }

  // NextJS Port 3000
  const isNextAppOpenLocal = await checkPort('localhost', 3000);
  const isNextAppOpenWeb = await checkPort('web', 3000);
  if (isNextAppOpenLocal) {
    logSuccess('Next.js web service is reachable locally on port 3000.');
  } else if (isNextAppOpenWeb) {
    logSuccess('Next.js web service is reachable inside the container network on port 3000.');
  } else {
    logWarning('Next.js web service is not currently running/reachable on port 3000.');
  }
}

async function checkExternalIntegrations() {
  logHeader('External Integrations Diagnostics');

  const prisma = new PrismaClient();
  let baseAIUrl = process.env.OPENAI_BASE_URL;
  let aiEnabled = true;

  try {
    const settings = await prisma.settings.findFirst();
    if (settings) {
      aiEnabled = settings.aiEnabled;
      if (settings.aiBaseUrl) {
        baseAIUrl = settings.aiBaseUrl;
      }
    }
  } catch {
    logWarning('Could not read settings from database, falling back to environment variables.');
  } finally {
    await prisma.$disconnect();
  }

  if (!aiEnabled) {
    logWarning('AI features are disabled in Settings. Skipping AI integrations check.');
    return;
  }

  if (!baseAIUrl) {
    logWarning('AI base URL is not configured (neither in Settings nor environment variables), skipping AI integrations check.');
    return;
  }

  try {
    logSuccess(`Verifying AI endpoint URL: ${baseAIUrl}`);
    // Extract base domain
    const url = new URL(baseAIUrl);
    const host = url.hostname;
    const port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80);

    const reachable = await checkPort(host, port, 3000);
    if (reachable) {
      logSuccess(`AI endpoint host '${host}:${port}' is reachable.`);
    } else {
      logFailure(`AI endpoint host '${host}:${port}' is unreachable.`);
    }
  } catch (error: unknown) {
    const err = error as Error;
    logFailure(`Invalid AI Base URL format: ${err.message || String(error)}`);
  }
}

async function main() {
  console.log(`${BOLD}${BLUE}=======================================${RESET}`);
  console.log(`${BOLD}${BLUE}      COINFLOW DIAGNOSTIC DOCTOR      ${RESET}`);
  console.log(`${BOLD}${BLUE}=======================================${RESET}`);

  let success = true;

  try {
    await checkEnvironment();
  } catch {
    success = false;
  }

  try {
    await checkDatabase();
  } catch {
    success = false;
  }

  try {
    await checkMigrations();
  } catch {
    success = false;
  }

  try {
    await checkNetworkLoops();
  } catch {
    success = false;
  }

  try {
    await checkExternalIntegrations();
  } catch {
    success = false;
  }

  logHeader('Diagnostics Summary');
  if (success) {
    console.log(`${GREEN}${BOLD}✔ Workspace health checks PASSED successfully! Ready to flow.${RESET}`);
    process.exit(0);
  } else {
    console.error(`${RED}${BOLD}✘ Workspace health checks FAILED. Please review the warnings/errors above.${RESET}`);
    process.exit(1);
  }
}

main();
