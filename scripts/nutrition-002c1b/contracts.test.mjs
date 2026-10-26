import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { classifications, requireHistoricalDefaultEquivalence, functionWitness, compareWitness } from './fidelity.mjs';
import { BASE, BASE_TREE, PROTOCOL, implementationDigest } from './protocol.mjs';
import { Cluster, IMAGE } from './local.mjs';
import { SECTIONS } from '../nutrition-002c1a/catalog.mjs';
const file = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
function raw() { const sections = Object.fromEntries(SECTIONS.map(s => [s, []])); Object.assign(sections, { roles: [{ oid: 1, rolname: 'fixture' }], namespaces: [{ oid: 2, nspname: 'private' }, { oid: 3, nspname: 'pg_catalog' }], classes: [{ oid: 4, relname: 'pg_proc', relnamespace: 3 }, { oid: 5, relname: 'pg_type', relnamespace: 3 }], attributes: [{}], types: [{ oid: 6, typname: 'int4', typnamespace: 3, typowner: 1 }], languages: [{ oid: 7, lanname: 'sql' }], databases: [{}], dependencies: [{ classid: 4, objid: 8, objsubid: 0, refclassid: 5, refobjid: 6, refobjsubid: 0, deptype: 'n' }], procedures: [{ oid: 8, proname: 'f', pronamespace: 2, proowner: 1, prolang: 7, proargtypes: [6], proallargtypes: null, proargmodes: null, proargnames: ['x'], pronargs: 1, pronargdefaults: 0, proargdefaults: null, prorettype: 6 }], acls: [{ catalog: 'pg_proc', object: 8, sub: 0, isNull: true, entries: [] }] }); return { contract: 'nutrition-002c1a-raw-snapshot/v1', postgres: '170006', database: 'postgres', isolation: 'repeatable read', readOnly: 'on', sections }; }
test('baseline, protocol, reviewed image and source digest are fixed', () => { assert.equal(BASE, 'a0e7440088ee2d9cd9eccd4706cdf9ecd07e6a8f'); assert.equal(BASE_TREE, 'c48c2d3f26726ede8b1c15ed66e0abd41ded1dfc'); assert.equal(PROTOCOL, 'nutrition-002c1b-ddl-stability/v1'); assert.match(implementationDigest(), /^[a-f0-9]{64}$/); assert.equal(IMAGE, 'docker.io/supabase/postgres@sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518'); });
test('local targets cannot name predecessor or remote resources', () => { for (const name of ['production', 'nutrition-002c1a-source', 'http://localhost'])
    assert.throws(() => new Cluster(name), /TARGET_DENIED/); });
test('independent classifications never confer eligibility', () => { const c = classifications(); assert.equal(c.productionRecoveryEligibility, false); for (const k of ['SNAPSHOT_HISTORICAL_FUNCTION_DEFAULT_FIDELITY', 'HISTORICAL_CATALOG_AND_DUMP_EQUIVALENCE', 'HOSTED_PROVIDER_DDL_ACCEPTANCE'])
    assert.equal(c[k], 'BLOCKED'); assert.throws(requireHistoricalDefaultEquivalence, /SEMANTICS_UNQUALIFIED/); });
test('no-default witness does not assert semantic equivalence', () => { const w = functionWitness(raw()); assert.equal(w.records[0].defaultSemantics, 'NO_DEFAULTS'); assert.equal(w.historicalDefaultEquivalence, false); });
test('raw default bytes remain opaque and untrusted', () => { const r = raw(); Object.assign(r.sections.procedures[0], { pronargdefaults: 1, proargdefaults: '{UNKNOWN_OPERATOR_AND_TYPE_NODE}' }); const w = functionWitness(r); assert.equal(w.records[0].tuple.proargdefaults, '{UNKNOWN_OPERATOR_AND_TYPE_NODE}'); assert.equal(w.records[0].defaultSemantics, 'UNRECONSTRUCTED_RAW_NODE_TREE'); assert.equal(w.fullHistoricalCatalog, false); });
test('missing, duplicate and unsupported dependency references refuse', () => { for (const mutate of [r => r.sections.types = [], r => r.sections.dependencies[0].refclassid = 999, r => r.sections.dependencies[0].refobjid = 999, r => r.sections.dependencies[0].refobjsubid = 2, r => r.sections.types.push({ ...r.sections.types[0] })]) {
    const r = raw();
    mutate(r);
    assert.throws(() => functionWitness(r), /REFERENCE|DEPENDENCY|INCOMPLETE|AMBIGUOUS/);
} });
test('invalid argument/default shapes refuse without normalization', () => { for (const patch of [{ proargmodes: ['i', 'o'] }, { proargnames: [] }, { pronargdefaults: 2 }, { pronargdefaults: 1 }, { proargdefaults: 'opaque' }]) {
    const r = raw();
    Object.assign(r.sections.procedures[0], patch);
    assert.throws(() => functionWitness(r), /ARGUMENT_SHAPE/);
} });
test('source-bound admission requires lock, original durable admission and strict terminal outcomes', () => { const sql = file('ops/recovery/nutrition-002c1b/ddl-v1.sql'); assert(sql.includes('recovery_ops.require_lock()')); assert(sql.includes('recovery_ops.admit(')); assert(sql.includes("p_protocol is distinct from '" + PROTOCOL + "'")); assert(sql.includes('a.deadline>clock_timestamp()')); assert(sql.includes('s.backend_start=a.owner_backend_start')); assert(sql.includes('c.expected_source=p_source')); assert(sql.includes("a.operation='BACKUP'")); assert(!/create\s+event\s+trigger/i.test(sql)); assert(!/security\s+definer/i.test(sql)); });
test('production capture denial remains in the original contract', () => { assert.match(file('scripts/phase-11i-capture-consistency.mjs'), /UNQUALIFIED|BLOCKED|CAPTURE/i); });
test('legitimate duplicate dependency edges are preserved and changed multiplicity refuses', () => { const r = raw(), base = functionWitness(r); r.sections.dependencies.push({ ...r.sections.dependencies[0] }); const duplicate = functionWitness(r); assert.equal(duplicate.records[0].directEdges.length, 2); assert.equal(duplicate.records[0].availableClosure.length, 2); assert.throws(() => compareWitness(base, duplicate), /MULTISET_MISMATCH/); });
