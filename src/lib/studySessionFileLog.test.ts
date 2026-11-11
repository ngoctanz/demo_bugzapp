import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendStudySessionLogCsv } from './studySessionFileLog';

test('private study CSV stores contact and duration once per session', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bugz-study-log-'));
  const filePath = path.join(dir, 'study_sessions.csv');
  const entry = {
    session_id: 'session-001',
    student_name: 'Bé Minh',
    account_name: 'Phụ huynh Minh',
    email: 'parent@example.com',
    phone: '0901234567',
    device_id: 'robot01',
    started_at: Date.UTC(2026, 10, 11, 1, 0, 0),
    ended_at: Date.UTC(2026, 10, 11, 1, 30, 0),
    good_duration_ms: 1_500_000,
    bad_duration_ms: 300_000,
  };

  try {
    assert.equal(appendStudySessionLogCsv(filePath, entry).appended, true);
    assert.equal(appendStudySessionLogCsv(filePath, entry).appended, false);
    const csv = fs.readFileSync(filePath, 'utf8');
    assert.match(csv, /student_name,account_name,email,phone/);
    assert.match(csv, /"Bé Minh"/);
    assert.match(csv, /"parent@example\.com"/);
    assert.match(csv, /"1800","30\.00"/);
    assert.equal(csv.trim().split(/\r?\n/).length, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('CSV neutralizes spreadsheet formulas in user-controlled fields', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bugz-study-log-'));
  const filePath = path.join(dir, 'study_sessions.csv');
  try {
    appendStudySessionLogCsv(filePath, {
      session_id: 'session-002',
      student_name: '=HYPERLINK("bad")',
      account_name: '+cmd',
      email: 'safe@example.com',
      phone: '@unsafe',
      device_id: 'robot01',
      started_at: 1_000,
      ended_at: 61_000,
    });
    const csv = fs.readFileSync(filePath, 'utf8');
    assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
    assert.match(csv, /"'\+cmd"/);
    assert.match(csv, /"'@unsafe"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

