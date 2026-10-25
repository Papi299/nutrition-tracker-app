import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalBooleanSql as tree } from './boolean-sql.mjs';

test('parenthesized AND/OR association preserves operand order and every operand', () => {
  assert.deepEqual(tree('CHECK ((((a) AND (b)) AND (c)))'), tree('CHECK ((a) AND (b) AND (c))'));
  assert.deepEqual(tree('WHEN (((a) OR (b)) OR (c))'), tree('WHEN ((a) OR (b) OR (c))'));
  for (const changed of ['CHECK ((b) AND (a) AND (c))', 'CHECK ((a) OR (b) OR (c))',
    'CHECK ((a) AND (b))', 'CHECK ((a) AND (b) AND (c) AND (c))',
    'CHECK (((a) OR (b)) AND (c))']) {
    assert.notDeepEqual(tree('CHECK ((a) AND (b) AND (c))'), tree(changed));
  }
});

test('SQL literals, quoted names, NOT and mixed precedence cannot be erased', () => {
  assert.notDeepEqual(tree("CHECK ((a = 'AND (OR)') AND (b))"), tree("CHECK ((a = 'OR (AND)') AND (b))"));
  assert.notDeepEqual(tree('CHECK (("AND") AND (b))'), tree('CHECK (("OR") AND (b))'));
  assert.notDeepEqual(tree('CHECK (NOT ((a) AND (b)))'), tree('CHECK ((a) AND (b))'));
  assert.notDeepEqual(tree('CHECK (((a) OR (b)) AND (c))'), tree('CHECK ((a) OR ((b) AND (c)))'));
  for (const invalid of ['(', ')', "CHECK ('unclosed)", 'CHECK ($$a$$)', 'CHECK (a -- b)', '('.repeat(140)+')'.repeat(140)]) {
    assert.throws(() => tree(invalid), /N002C1_SQL_TREE_/);
  }
});

test('CodeQL result gate requires successful nonempty analysis and rejects findings', () => {
  const root = mkdtempSync(join(tmpdir(), 'nutrition-002c1-sarif-test-'));
  try {
    const sarifRoot = join(root,'sarif'); mkdirSync(sarifRoot);
    const file = join(sarifRoot,'javascript.sarif');
    const base = {version:'2.1.0',runs:[{tool:{driver:{name:'CodeQL',rules:[{id:'synthetic-analysis'}]}},invocations:[{executionSuccessful:true}],results:[]}]};
    let index = 0;
    function execute(value) {
      writeFileSync(file,JSON.stringify(value));
      const output=join(root,'result-'+index+++'.json');
      const result=spawnSync(process.execPath,[fileURLToPath(new URL('./check-sarif.mjs',import.meta.url)),sarifRoot,output],{
        env:{PATH:process.env.PATH,CANDIDATE_SHA:'a'.repeat(40),ANALYSIS_LANGUAGE:'javascript-typescript'},encoding:'utf8',
      });
      return {status:result.status,output};
    }
    const valid=execute(base); assert.equal(valid.status,0);
    assert.equal(JSON.parse(readFileSync(valid.output)).recoveryEligible,false);
    for (const changed of [
      {...base,runs:[]},
      {...base,runs:[{...base.runs[0],tool:{driver:{name:'CodeQL',rules:[]}}}]},
      {...base,runs:[{...base.runs[0],invocations:[{executionSuccessful:false}]}]},
      {...base,runs:[{...base.runs[0],results:[{ruleId:'synthetic-finding'}]}]},
    ]) assert.notEqual(execute(changed).status,0);
  } finally { rmSync(root,{recursive:true,force:true}); }
});
