import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { logger } from '../src/utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split('=');
    if (typeof inlineValue !== 'undefined') {
      args[rawKey] = inlineValue;
      continue;
    }

    const nextToken = argv[index + 1];
    if (!nextToken || nextToken.startsWith('--')) {
      args[rawKey] = true;
      continue;
    }

    args[rawKey] = nextToken;
    index += 1;
  }

  return args;
}

function ensureCommand(command) {
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(`Narzędzie ${command} jest wymagane, ale nie zostało znalezione w ścieżce systemowej (PATH).`);
  }
}

async function resolveLatestBackup(backupDir) {
  const entries = await readdir(backupDir, { withFileTypes: true });
  const dumpFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.dump'))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left));

  if (dumpFiles.length === 0) {
    throw new Error(`Nie znaleziono plików kopii zapasowych (.dump) w katalogu ${backupDir}`);
  }

  return path.join(backupDir, dumpFiles[0]);
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(`${command} nie powiodło się: ${result.stderr || result.stdout || 'Nieznany błąd'}`);
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const backupDir = path.resolve(args['backup-dir'] || process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));
  const targetUrl = args['target-url'] || process.env.POSTGRES_RESTORE_URL || process.env.POSTGRES_URL;

  if (!targetUrl) {
    throw new Error('Brak docelowego URL bazy danych. Ustaw POSTGRES_RESTORE_URL lub POSTGRES_URL.');
  }

  if (!args.confirm) {
    throw new Error('Przywracanie wymaga jawnego potwierdzenia. Uruchom ponownie z flagą --confirm.');
  }

  ensureCommand('pg_restore');
  ensureCommand('psql');

  const inputPath = args.input ? path.resolve(args.input) : await resolveLatestBackup(backupDir);
  const dropSchema = args['drop-schema'] === true || args['drop-schema'] === 'true';

  logger.warn('Rozpoczynanie przywracania bazy danych', {
    event: 'restore.start',
    inputPath,
    targetUrl,
    dropSchema
  });

  if (dropSchema) {
    runCommand('psql', [
      '--dbname',
      targetUrl,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
    ]);
  }

  runCommand('pg_restore', [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    '--dbname',
    targetUrl,
    inputPath
  ]);

  logger.info('Przywracanie bazy danych zakończone', {
    event: 'restore.completed',
    inputPath,
    targetUrl
  });
}

run().catch((error) => {
  logger.error('Polecenie przywracania nie powiodło się', {
    event: 'restore.failed',
    error: error.message
  });
  process.exit(1);
});
