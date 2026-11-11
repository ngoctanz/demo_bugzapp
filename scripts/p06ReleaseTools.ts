import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { P01RbacDomainService } from '../src/domain/p01RbacStore';
import {
  DEMO_6_MINUTE_SCRIPT,
  P06_ACCEPTANCE_MATRIX_30,
  P0_SECURITY_AUDIT_ITEMS,
  verifyNoSecretsLeakedReport,
} from '../src/domain/p06AcceptanceMatrix';

function main() {
  const rootDir = process.cwd();
  const docsProjectDir = path.join(rootDir, 'docs', 'project');
  fs.mkdirSync(docsProjectDir, { recursive: true });

  const store = new P01RbacDomainService();
  const superAdminActor = {
    uid: 'uid-superadmin-01',
    email: 'minhquantran4312@gmail.com',
    email_verified: true,
    superadmin: true,
    role: 'superadmin' as const,
  };

  // 1. Export clean Demo Backup Seed JSON (before benchmark mutations)
  const backupResult = store.exportDemoBackupSnapshot(superAdminActor);
  if (!backupResult.ok || !backupResult.backup) {
    throw new Error(`Failed to export demo backup snapshot: ${backupResult.message}`);
  }
  const backupSeedPath = path.join(docsProjectDir, 'DEMO_BACKUP_SEED_P06.json');
  fs.writeFileSync(backupSeedPath, JSON.stringify(backupResult.backup, null, 2), 'utf8');

  // 2. Run 20-sample latency benchmark (Section 17 Artifact: p95 <= 5000ms)
  const benchmark = store.runIngestLatencyBenchmark20Samples(superAdminActor);

  // 3. Verify secret hygiene across environment and tracked files
  const secretHygiene = verifyNoSecretsLeakedReport(process.env);
  if (!secretHygiene.passed) {
    throw new Error(`Secret hygiene check failed: ${secretHygiene.details}`);
  }

  // 4. Create clean source archive in /tmp (outside repo so Git/GitHub push stays ultra-lightweight)
  const archivePath = '/tmp/BUGZ_BrightUpGenZ_P06_Clean_Source.tar.gz';
  try {
    execSync(
      `tar -czf "${archivePath}" ` +
        `--exclude=".git" ` +
        `--exclude="node_modules" ` +
        `--exclude="dist" ` +
        `--exclude=".playwright-cli" ` +
        `--exclude=".env" ` +
        `--exclude=".env.local" ` +
        `--exclude="public/assets" ` +
        `package.json tsconfig.json vite.config.ts firebase.json database.rules.json storage.rules ` +
        `.env.example index.html server.ts README.md DEPLOY_FIREBASE.md metadata.json ` +
        `src scripts docs/project public/icon.svg public/manifest.json public/sw.js public/firebase-messaging-sw.js`,
      { cwd: rootDir, stdio: 'pipe' }
    );
  } catch (err) {
    console.warn('Warning creating tar.gz archive:', err);
  }

  const archiveExists = fs.existsSync(archivePath);
  const archiveSizeBytes = archiveExists ? fs.statSync(archivePath).size : 0;

  // 5. Write CHECKPOINT_P06.json
  const passCount = P06_ACCEPTANCE_MATRIX_30.filter(
    (item) => item.liveExternalStatus === 'PASS'
  ).length;
  const externalBlockedItems = P06_ACCEPTANCE_MATRIX_30.filter(
    (item) => item.liveExternalStatus === 'BLOCKED'
  );

  const checkpointPayload = {
    stage: 'P06',
    version: '1.0.0-p06',
    generated_at: new Date().toISOString(),
    project_id: 'gen-lang-client-0531599250',
    region: 'asia-southeast1',
    summary: {
      total_test_cases: P06_ACCEPTANCE_MATRIX_30.length,
      passed_in_repo_and_browser: passCount,
      passed_code_blocked_live_external: externalBlockedItems.length,
      external_blocked_codes: externalBlockedItems.map((i) => i.code),
      p0_guardrails_passed: P0_SECURITY_AUDIT_ITEMS.filter((i) => i.status === 'PASS').length,
      p0_guardrails_total: P0_SECURITY_AUDIT_ITEMS.length,
    },
    latency_benchmark_20_samples: benchmark,
    secret_hygiene_t30: secretHygiene,
    artifacts: {
      demo_backup_seed: 'docs/project/DEMO_BACKUP_SEED_P06.json',
      clean_source_archive: archiveExists
        ? '/tmp/BUGZ_BrightUpGenZ_P06_Clean_Source.tar.gz'
        : null,
      clean_source_archive_bytes: archiveSizeBytes,
      deploy_guide: 'DEPLOY_FIREBASE.md',
      readme: 'README.md',
      storage_rules: 'storage.rules',
      rtdb_rules: 'database.rules.json',
      firebase_config: 'firebase.json',
    },
    demo_6_minute_script: DEMO_6_MINUTE_SCRIPT,
  };

  const checkpointPath = path.join(docsProjectDir, 'CHECKPOINT_P06.json');
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpointPayload, null, 2), 'utf8');

  console.log(
    JSON.stringify(
      {
        ok: true,
        backupSeedPath: 'docs/project/DEMO_BACKUP_SEED_P06.json',
        checkpointPath: 'docs/project/CHECKPOINT_P06.json',
        cleanSourceArchive: archiveExists
          ? '/tmp/BUGZ_BrightUpGenZ_P06_Clean_Source.tar.gz'
          : null,
        cleanSourceArchiveBytes: archiveSizeBytes,
        benchmarkP95Ms: benchmark.p95Ms,
        secretHygienePassed: secretHygiene.passed,
      },
      null,
      2
    )
  );
}

main();
