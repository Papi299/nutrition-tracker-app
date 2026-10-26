import { validateRaw, rawSql, functionSubset } from '../nutrition-002c1a/catalog.mjs';
import { canonical } from '../nutrition-002c1/catalog.mjs';
import { Snapshot } from './snapshot.mjs';
const fail = code => { throw new Error(code); };
export async function observe(lease, reader) {
    if (!(lease instanceof Snapshot))
        fail('N002C1B_SNAPSHOT_REQUIRED');
    return validateRaw(JSON.parse((await lease.read(reader, rawSql())).join('\n')));
}
// A raw dependency witness, NOT a semantic SQL reconstruction. No node-tree
// parser, reg* rendering or current-state helper enters this representation.
export function functionWitness(raw, selectedOids) {
    validateRaw(raw);
    functionSubset(raw);
    if (selectedOids !== undefined && (!Array.isArray(selectedOids) || !selectedOids.length || new Set(selectedOids.map(String)).size !== selectedOids.length))
        fail("N002C1B_SELECTION_DENIED");
    const s = raw.sections;
    const indexed = rows => {
        const m = new Map();
        for (const r of rows) {
            const id = String(r.oid);
            if (!/^[1-9][0-9]{0,9}$/.test(id) || Number(id) > 4294967295 || m.has(id))
                fail('N002C1B_DUPLICATE_OR_INVALID_REFERENCE');
            m.set(id, r);
        }
        return m;
    };
    const maps = { pg_proc: indexed(s.procedures), pg_type: indexed(s.types), pg_namespace: indexed(s.namespaces), pg_language: indexed(s.languages), pg_operator: indexed(s.operators), pg_collation: indexed(s.collations), pg_extension: indexed(s.extensions) };
    const roles = indexed(s.roles), classes = indexed(s.classes);
    const get = (m, id) => { const r = m.get(String(id)); if (!r)
        fail('N002C1B_MISSING_REFERENCE'); return r; };
    const records = [];
    for (const id of selectedOids ?? [])
        if (!maps.pg_proc.has(String(id)))
            fail("N002C1B_MISSING_REFERENCE");
    for (const p of s.procedures) {
        if (selectedOids !== undefined && !selectedOids.some(id => String(id) === String(p.oid)))
            continue;
        const ns = get(maps.pg_namespace, p.pronamespace);
        if (!['public', 'private', 'ingestion'].includes(ns.nspname))
            continue;
        get(roles, p.proowner);
        get(maps.pg_language, p.prolang);
        const all = p.proallargtypes ?? p.proargtypes;
        if (!Array.isArray(all) || (p.proargmodes !== null && (!Array.isArray(p.proargmodes) || p.proargmodes.length !== all.length)) ||
            (p.proargnames !== null && (!Array.isArray(p.proargnames) || p.proargnames.length !== all.length)) ||
            !Number.isInteger(p.pronargdefaults) || p.pronargdefaults < 0 || p.pronargdefaults > p.pronargs ||
            (p.pronargdefaults === 0) !== (p.proargdefaults === null))
            fail('N002C1B_ARGUMENT_SHAPE');
        for (const id of [...all, p.prorettype]) {
            const t = get(maps.pg_type, id);
            get(maps.pg_namespace, t.typnamespace);
            get(roles, t.typowner);
        }
        const rootClass = [...classes.values()].find(c => c.relname === 'pg_proc' && get(maps.pg_namespace, c.relnamespace).nspname === 'pg_catalog');
        if (!rootClass)
            fail('N002C1B_MISSING_REFERENCE');
        const edges = s.dependencies.filter(e => String(e.classid) === String(rootClass.oid) && String(e.objid) === String(p.oid));
        const pending = [{ classid: rootClass.oid, objid: p.oid }], visited = new Set(), closure = [];
        while (pending.length) {
            const node = pending.pop(), key = String(node.classid) + ':' + String(node.objid);
            if (visited.has(key))
                continue;
            visited.add(key);
            for (const e of s.dependencies.filter(d => String(d.classid) === String(node.classid) && String(d.objid) === String(node.objid))) {
                // pg_depend can contain identical rows. Preserve their multiplicity;
                // visit object nodes once to bound cycles without deleting real edges.
                closure.push(e);
                const c = get(classes, e.refclassid), name = c.relname;
                if (get(maps.pg_namespace, c.relnamespace).nspname !== 'pg_catalog' || !Object.hasOwn(maps, name) || e.refobjsubid !== 0)
                    fail('N002C1B_UNSUPPORTED_DEPENDENCY');
                get(maps[name], e.refobjid);
                pending.push({ classid: e.refclassid, objid: e.refobjid });
            }
        }
        const shared = s.sharedDependencies.filter(e => String(e.classid) === String(rootClass.oid) && String(e.objid) === String(p.oid));
        for (const e of shared) {
            const c = get(classes, e.refclassid);
            if (c.relname !== 'pg_authid' || get(maps.pg_namespace, c.relnamespace).nspname !== 'pg_catalog')
                fail('N002C1B_UNSUPPORTED_SHARED_DEPENDENCY');
            get(roles, e.refobjid);
        }
        records.push({ tuple: p, acl: s.acls.filter(a => a.catalog === 'pg_proc' && String(a.object) === String(p.oid) && a.sub === 0), directEdges: edges, availableClosure: closure, sharedEdges: shared,
            defaultSemantics: p.pronargdefaults ? 'UNRECONSTRUCTED_RAW_NODE_TREE' : 'NO_DEFAULTS',
            historicalEquivalence: false });
    }
    return { contract: 'nutrition-002c1b-function-witness/v1', records, scope: 'RAW_FUNCTION_AND_AVAILABLE_DEPENDENCY_WITNESS_ONLY', historicalDefaultEquivalence: false, fullHistoricalCatalog: false, productionRecoveryEligibility: false };
}
export function requireHistoricalDefaultEquivalence() { fail('N002C1B_HISTORICAL_DEFAULT_SEMANTICS_UNQUALIFIED'); }
export function classifications() {
    return { LOCAL_DDL_COORDINATION: 'LOCAL_FIXTURE_QUALIFICATION_ONLY', LOCAL_DDL_STABILITY_UNDER_COMPLIANT_OPERATORS: 'CONDITIONAL_LOCAL_POLICY_ONLY', SNAPSHOT_HISTORICAL_FUNCTION_DEFAULT_FIDELITY: 'BLOCKED', HISTORICAL_CATALOG_AND_DUMP_EQUIVALENCE: 'BLOCKED', HOSTED_PROVIDER_DDL_ACCEPTANCE: 'BLOCKED', PRODUCTION_RECOVERY_ELIGIBILITY: 'DENIED', productionRecoveryEligibility: false };
}
export function compareWitness(expected, actual) {
    const normalize = w => w.records.map(r => canonical({ ...r, directEdges: r.directEdges.map(canonical).sort(), availableClosure: r.availableClosure.map(canonical).sort(), sharedEdges: r.sharedEdges.map(canonical).sort() })).sort();
    if (expected.contract !== 'nutrition-002c1b-function-witness/v1' || actual.contract !== expected.contract || canonical(normalize(expected)) !== canonical(normalize(actual)))
        fail('N002C1B_WITNESS_MULTISET_MISMATCH');
    return { historicalDefaultEquivalence: false, fullHistoricalCatalog: false, productionRecoveryEligibility: false };
}
