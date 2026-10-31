"""Independent Decimal comparison of local synthetic raw records and SQL state.

Uses the accepted independent scientific oracle and normative Markdown matrix,
never TypeScript mapping/projection/diff code. Reads only synthetic stdin.
"""
import importlib.util
import json
from decimal import Decimal
from pathlib import Path
import sys

source = Path('scripts/nutrition-usda-full35-local-qual-001/oracle.py')
spec = importlib.util.spec_from_file_location('accepted_full35_oracle', source)
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)


def compare(packet):
    matrix = oracle.read_matrix('docs/nutrition-usda-full35-mapping-spec.md')
    expected, expected_evidence = [], []
    bindings = {r['fdc_id']: r['food_id'] for r in packet['identity_bindings']}
    assert len(bindings) == len(set(bindings.values())) == 353
    mapping_hash = '028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c'
    fields = ['fdc_id', 'food_id', 'mapping_hash', 'code', 'value', 'source_id', 'source_unit', 'application_unit',
              'basis', 'semantic', 'derivation_code', 'derivation_description', 'raw_hash', 'missing_reason']
    for index, record in enumerate(packet['raw_records']):
        raw_hash = oracle.fingerprint(record)
        for target in matrix:
            state, evidence = oracle.state(record, target, raw_hash, index)
            state.update(food_id=bindings[state['fdc_id']], mapping_hash=mapping_hash)
            expected.append({k: state[k] for k in fields})
            for row in evidence:
                row.update(food_id=bindings[row['fdc_id']], mapping_hash=mapping_hash)
            expected_evidence.extend(evidence)
    actual = packet['states']
    differences = oracle.compare_sets(expected, actual)
    assert not differences, 'independent state mismatch: ' + json.dumps(differences[:1])
    assert len(expected) == 12355
    assert sum(r['value'] is not None for r in expected) == 6261
    assert sum(r['value'] is None for r in expected) == 6094
    assert sum(r['missing_reason'] in {'semantic_hold', 'unavailable_in_approved_source'} for r in expected) == 1059
    present = {(r['food_id'], r['mapping_hash'], r['fdc_id'], r['code']): r['value'] for r in expected if r['value'] is not None}
    public = {(r['food_id'], r['mapping_hash'], r['fdc_id'], r['code']): r['value'] for r in packet['public_rows']}
    assert len(public) == len(packet['public_rows']) == 6261 and public == present, 'public values differ'
    evidence_fields = ['fdc_id', 'food_id', 'mapping_hash', 'code', 'value', 'source_id', 'source_unit', 'application_unit',
                       'basis', 'semantic', 'derivation_code', 'derivation_description', 'raw_hash',
                       'source_name', 'footnote', 'loq', 'raw_field_path']
    expected_evidence = [{k: e[k] for k in evidence_fields} for e in expected_evidence]
    by_evidence = lambda rows: sorted(rows, key=lambda e: (int(e['fdc_id']), e['code'], int(e['source_id'])))
    assert by_evidence(expected_evidence) == by_evidence(packet['interpretation_evidence']), 'raw evidence differs'
    assert len(expected_evidence) == 6452
    return dict(states=12355, present=6261, missing=6094, withheld=1059,
                source_method_records=6452, public_values=6261,
                tuple_hash=oracle.fingerprint(expected), public_hash=oracle.fingerprint(packet['public_rows']))


if __name__ == '__main__':
    data = json.load(sys.stdin, parse_float=Decimal)
    result = compare(data)
    # An equal-count single-value change must fail through this independent
    # comparison too; this verifies the oracle's own refusal path.
    original = data['states'][0]['value']
    data['states'][0]['value'] = '999.9999' if original != '999.9999' else '998.9999'
    try:
        compare(data)
    except AssertionError:
        result['same_count_wrong_value_refused'] = True
    else:
        raise AssertionError('oracle accepted a wrong value at unchanged counts')
    print(json.dumps(result, sort_keys=True))
