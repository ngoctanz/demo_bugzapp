import fs from 'node:fs';
import path from 'node:path';
import type { UserRole } from '../types/bugz.ts';

export interface RtdbAuthContext {
  uid: string;
  token: {
    email?: string;
    email_verified?: boolean;
    admin?: boolean;
    superadmin?: boolean;
    role?: UserRole;
  };
}

export interface RtdbQueryContext {
  orderByChild?: string | null;
  equalTo?: string | number | boolean | null;
  limitToLast?: number | null;
  limitToFirst?: number | null;
  startAt?: string | number | null;
  endAt?: string | number | null;
}

export interface RulesEvaluationResult {
  allowed: boolean;
  reason: string;
  matchedPath: string;
  indexVerified?: boolean;
}

/**
 * Helper class mimicking Firebase RTDB RuleDataSnapshot (`root`, `data`, `newData`)
 */
export class RuleDataSnapshot {
  private readonly tree: unknown;
  private readonly currentPath: string[];
  private readonly rootTree: unknown;

  constructor(rootTree: unknown, currentPath: string[]) {
    this.rootTree = rootTree;
    this.currentPath = currentPath;
    this.tree = RuleDataSnapshot.getAtPath(rootTree, currentPath);
  }

  private static getAtPath(obj: unknown, segments: string[]): unknown {
    let cur: unknown = obj;
    for (const seg of segments) {
      if (!seg) continue;
      if (cur !== null && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[seg];
      } else {
        return null;
      }
    }
    return cur === undefined ? null : cur;
  }

  val(): unknown {
    return this.tree === undefined ? null : this.tree;
  }

  exists(): boolean {
    return this.tree !== null && this.tree !== undefined;
  }

  child(relPath: string): RuleDataSnapshot {
    const clean = relPath.split('/').filter(Boolean);
    return new RuleDataSnapshot(this.rootTree, [...this.currentPath, ...clean]);
  }

  parent(): RuleDataSnapshot {
    if (this.currentPath.length === 0) {
      return new RuleDataSnapshot(this.rootTree, []);
    }
    return new RuleDataSnapshot(this.rootTree, this.currentPath.slice(0, -1));
  }

  hasChild(childPath: string): boolean {
    return this.child(childPath).exists();
  }

  hasChildren(children?: string[]): boolean {
    if (!this.exists() || typeof this.tree !== 'object' || this.tree === null) {
      return false;
    }
    if (!children || children.length === 0) {
      return Object.keys(this.tree as Record<string, unknown>).length > 0;
    }
    return children.every((c) => this.hasChild(c));
  }

  isString(): boolean {
    return typeof this.tree === 'string';
  }

  isNumber(): boolean {
    return typeof this.tree === 'number' && !Number.isNaN(this.tree);
  }

  isBoolean(): boolean {
    return typeof this.tree === 'boolean';
  }
}

/**
 * Load database.rules.json from workspace root
 */
export function loadDatabaseRulesJson(customPath?: string): Record<string, unknown> {
  const resolved = customPath || path.resolve(process.cwd(), 'database.rules.json');
  const raw = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

interface MatchedRuleNode {
  ruleNode: Record<string, unknown>;
  wildcards: Record<string, string>;
  pathSegments: string[];
}

function collectRuleChain(
  rulesRoot: Record<string, unknown>,
  pathSegments: string[]
): MatchedRuleNode[] {
  const chain: MatchedRuleNode[] = [];
  let currentRule: Record<string, unknown> | undefined = rulesRoot;
  const wildcards: Record<string, string> = {};

  chain.push({
    ruleNode: currentRule,
    wildcards: { ...wildcards },
    pathSegments: [],
  });

  for (let i = 0; i < pathSegments.length; i++) {
    const seg = pathSegments[i];
    if (!currentRule || typeof currentRule !== 'object') break;

    if (seg in currentRule && typeof currentRule[seg] === 'object' && currentRule[seg] !== null) {
      currentRule = currentRule[seg] as Record<string, unknown>;
    } else {
      const wildcardKey = Object.keys(currentRule).find((k) => k.startsWith('$'));
      if (wildcardKey && typeof currentRule[wildcardKey] === 'object' && currentRule[wildcardKey] !== null) {
        wildcards[wildcardKey] = seg;
        currentRule = currentRule[wildcardKey] as Record<string, unknown>;
      } else {
        currentRule = undefined;
        break;
      }
    }

    if (currentRule) {
      chain.push({
        ruleNode: currentRule,
        wildcards: { ...wildcards },
        pathSegments: pathSegments.slice(0, i + 1),
      });
    }
  }

  return chain;
}

function evaluateRuleExpression(
  expr: boolean | string | undefined,
  auth: RtdbAuthContext | null,
  rootSnap: RuleDataSnapshot,
  dataSnap: RuleDataSnapshot,
  newDataSnap: RuleDataSnapshot,
  query: RtdbQueryContext,
  wildcards: Record<string, string>
): boolean {
  if (expr === undefined) return false;
  if (typeof expr === 'boolean') return expr;
  if (typeof expr !== 'string') return false;

  const wildcardNames = Object.keys(wildcards);
  const wildcardValues = wildcardNames.map((k) => wildcards[k]);

  try {
    const fn = new Function(
      'auth',
      'root',
      'data',
      'newData',
      'query',
      'now',
      ...wildcardNames,
      `"use strict"; return Boolean(${expr});`
    );
    return Boolean(
      fn(
        auth,
        rootSnap,
        dataSnap,
        newDataSnap,
        {
          orderByChild: query.orderByChild ?? null,
          equalTo: query.equalTo ?? null,
          limitToLast: query.limitToLast ?? null,
          limitToFirst: query.limitToFirst ?? null,
          startAt: query.startAt ?? null,
          endAt: query.endAt ?? null,
        },
        Date.now(),
        ...wildcardValues
      )
    );
  } catch {
    return false;
  }
}

/**
 * Evaluate a READ or QUERY operation against database.rules.json
 * Following Firebase RTDB semantics:
 * - If any ancestor or target node has `.read` evaluating to `true`, read is granted.
 * - If `query.orderByChild` is specified, the target node MUST also declare `.indexOn` containing that field.
 */
export function evaluateRtdbRead(params: {
  rulesJson?: Record<string, unknown>;
  dbState: Record<string, unknown>;
  path: string;
  auth: RtdbAuthContext | null;
  query?: RtdbQueryContext;
}): RulesEvaluationResult {
  const rulesRoot = (params.rulesJson?.rules || loadDatabaseRulesJson().rules) as Record<string, unknown>;
  const segments = params.path.split('/').filter(Boolean);
  const chain = collectRuleChain(rulesRoot, segments);
  const rootSnap = new RuleDataSnapshot(params.dbState, []);
  const queryCtx: RtdbQueryContext = params.query || {};

  // Check indexOn if query.orderByChild is used
  let indexVerified = true;
  if (queryCtx.orderByChild) {
    const targetNode = chain[chain.length - 1];
    const indexOn = targetNode?.ruleNode?.['.indexOn'];
    const hasIndex =
      Array.isArray(indexOn) && indexOn.includes(queryCtx.orderByChild);
    if (!hasIndex) {
      return {
        allowed: false,
        reason: `Missing .indexOn for "${queryCtx.orderByChild}" at path /${segments.join('/')}`,
        matchedPath: `/${segments.join('/')}`,
        indexVerified: false,
      };
    }
    indexVerified = true;
  }

  for (const node of chain) {
    const readRule = node.ruleNode['.read'] as boolean | string | undefined;
    const dataSnap = new RuleDataSnapshot(params.dbState, node.pathSegments);
    if (
      evaluateRuleExpression(
        readRule,
        params.auth,
        rootSnap,
        dataSnap,
        dataSnap,
        queryCtx,
        node.wildcards
      )
    ) {
      return {
        allowed: true,
        reason: `Read granted by rule at /${node.pathSegments.join('/')}`,
        matchedPath: `/${node.pathSegments.join('/')}`,
        indexVerified,
      };
    }
  }

  return {
    allowed: false,
    reason: `Permission denied: .read evaluated to false at /${segments.join('/')}`,
    matchedPath: `/${segments.join('/')}`,
    indexVerified,
  };
}

function cloneDeep<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

function setAtPath(
  rootObj: Record<string, unknown>,
  segments: string[],
  value: unknown,
  isPatch: boolean
): Record<string, unknown> {
  const nextRoot = cloneDeep(rootObj);
  if (segments.length === 0) {
    return (value as Record<string, unknown>) || {};
  }
  let cur: Record<string, unknown> = nextRoot;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (typeof cur[seg] !== 'object' || cur[seg] === null) {
      cur[seg] = {};
    }
    cur = cur[seg] as Record<string, unknown>;
  }
  const lastSeg = segments[segments.length - 1];
  if (isPatch && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const existing =
      typeof cur[lastSeg] === 'object' && cur[lastSeg] !== null
        ? (cur[lastSeg] as Record<string, unknown>)
        : {};
    const merged: Record<string, unknown> = { ...existing };
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null) {
        delete merged[k];
      } else {
        merged[k] = v;
      }
    }
    cur[lastSeg] = merged;
  } else if (value === null) {
    delete cur[lastSeg];
  } else {
    cur[lastSeg] = value;
  }
  return nextRoot;
}

/**
 * Evaluate a WRITE (PUT or PATCH) operation against database.rules.json
 * Following Firebase RTDB semantics:
 * - For a PUT at `/a/b`, `.write` must evaluate to true on `/a/b` or an ancestor, AND `.validate` must pass on `/a/b` and all present children.
 * - For a PATCH at `/a/b` with `{ field1: val1, field2: val2 }`, if `/a/b` itself has `.write: false`, each patched child path `/a/b/field1`, `/a/b/field2` is checked individually!
 */
export function evaluateRtdbWrite(params: {
  rulesJson?: Record<string, unknown>;
  dbState: Record<string, unknown>;
  path: string;
  value: unknown;
  method?: 'PUT' | 'PATCH';
  auth: RtdbAuthContext | null;
}): RulesEvaluationResult & { nextDbState?: Record<string, unknown> } {
  const rulesRoot = (params.rulesJson?.rules || loadDatabaseRulesJson().rules) as Record<string, unknown>;
  const segments = params.path.split('/').filter(Boolean);
  const isPatch = params.method === 'PATCH';
  const nextState = setAtPath(params.dbState, segments, params.value, isPatch);

  // If PATCH on an object, check if parent write is allowed; if not, check each patched key path
  if (isPatch && typeof params.value === 'object' && params.value !== null && !Array.isArray(params.value)) {
    const patchEntries = Object.entries(params.value as Record<string, unknown>);
    for (const [childKey, childVal] of patchEntries) {
      const childRes = evaluateSingleWritePath(
        rulesRoot,
        params.dbState,
        nextState,
        [...segments, childKey],
        childVal,
        params.auth
      );
      if (!childRes.allowed) {
        return childRes;
      }
    }
    return {
      allowed: true,
      reason: `PATCH granted for all fields at /${segments.join('/')}`,
      matchedPath: `/${segments.join('/')}`,
      nextDbState: nextState,
    };
  }

  const singleRes = evaluateSingleWritePath(
    rulesRoot,
    params.dbState,
    nextState,
    segments,
    params.value,
    params.auth
  );
  if (!singleRes.allowed) {
    return singleRes;
  }
  return {
    ...singleRes,
    nextDbState: nextState,
  };
}

function evaluateSingleWritePath(
  rulesRoot: Record<string, unknown>,
  oldState: Record<string, unknown>,
  nextState: Record<string, unknown>,
  segments: string[],
  newValue: unknown,
  auth: RtdbAuthContext | null
): RulesEvaluationResult {
  const chain = collectRuleChain(rulesRoot, segments);
  const rootOldSnap = new RuleDataSnapshot(oldState, []);
  let writeGranted = false;
  let grantedAt = '';

  for (const node of chain) {
    const writeRule = node.ruleNode['.write'] as boolean | string | undefined;
    const dataSnap = new RuleDataSnapshot(oldState, node.pathSegments);
    const newDataSnap = new RuleDataSnapshot(nextState, node.pathSegments);
    if (
      evaluateRuleExpression(
        writeRule,
        auth,
        rootOldSnap,
        dataSnap,
        newDataSnap,
        {},
        node.wildcards
      )
    ) {
      writeGranted = true;
      grantedAt = `/${node.pathSegments.join('/')}`;
      break;
    }
  }

  if (!writeGranted) {
    return {
      allowed: false,
      reason: `Permission denied: .write evaluated to false at /${segments.join('/')}`,
      matchedPath: `/${segments.join('/')}`,
    };
  }

  // If deleting (newValue === null), .validate is skipped in RTDB
  if (newValue !== null && newValue !== undefined) {
    for (const node of chain) {
      const validateRule = node.ruleNode['.validate'] as boolean | string | undefined;
      if (validateRule !== undefined) {
        const dataSnap = new RuleDataSnapshot(oldState, node.pathSegments);
        const newDataSnap = new RuleDataSnapshot(nextState, node.pathSegments);
        if (
          !evaluateRuleExpression(
            validateRule,
            auth,
            rootOldSnap,
            dataSnap,
            newDataSnap,
            {},
            node.wildcards
          )
        ) {
          return {
            allowed: false,
            reason: `Validation failed: .validate evaluated to false at /${node.pathSegments.join('/')}`,
            matchedPath: `/${node.pathSegments.join('/')}`,
          };
        }
      }
    }
  }

  return {
    allowed: true,
    reason: `Write granted at ${grantedAt}`,
    matchedPath: grantedAt,
  };
}
