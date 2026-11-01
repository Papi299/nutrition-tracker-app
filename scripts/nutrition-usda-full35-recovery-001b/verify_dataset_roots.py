"""Independently reconstruct restored v1/v2 dataset roots without an executor."""
import copy
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'nutrition-usda-full35-local-qual-001'))
from oracle import fingerprint


def compare(packet):
    results = []
    heads = sorted(packet['heads'], key=lambda h: h['version'])
    assert [h['version'] for h in heads] == list(range(1, len(heads) + 1))
    for head in heads:
        projections = sorted((p for p in packet['projections'] if p['receipt_id'] == head['receipt_id']), key=lambda p: p['food_id'])
        assert len(projections) == len({p['food_id'] for p in projections}) == 353
        assert all(p['is_public'] and not p['is_archived'] for p in projections)
        if head['version'] == 1:
            body = dict(contract_version='foundation-dataset-projection/v1', dataset_id=head['dataset_id'],
                        environment=head['environment'], source_release_id=head['source_release_id'],
                        foods=[dict(food_id=p['food_id'], projection_hash=p['projection_hash']) for p in projections])
        else:
            body = dict(contract_version='foundation-mapping-dataset-projection/v2', dataset_id=head['dataset_id'],
                        environment=head['environment'], source_release_id=head['source_release_id'],
                        mapping_version_id=head['mapping_version_id'],
                        mapping_hash='028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c',
                        foods=[dict(food_id=p['food_id'], projection_contract_version=p['projection_contract_version'],
                                    lifecycle_projection_hash=p['lifecycle_projection_hash'], lifecycle_state='active') for p in projections])
        actual = fingerprint(body)
        assert actual == head['fingerprint'], f"Independent dataset root mismatch at head {head['version']}"
        results.append(dict(head_version=head['version'], foods=353, fingerprint=actual, result='PASS'))
    assert packet['pointer']['current_dataset_projection_head_id'] == heads[-1]['id']
    assert packet['pointer']['current_projection_fingerprint'] == results[-1]['fingerprint']
    return dict(result='PASS', heads=results, current_pointer_verified=True)


if __name__ == '__main__':
    packet = json.load(sys.stdin)
    result = compare(packet)
    changed = copy.deepcopy(packet)
    field = 'projection_hash' if len(packet['heads']) == 1 else 'lifecycle_projection_hash'
    row = next(p for p in changed['projections'] if p['receipt_id'] == changed['heads'][-1]['receipt_id'])
    row[field] = 'f' * 64 if row[field] != 'f' * 64 else 'e' * 64
    try:
        compare(changed)
    except AssertionError:
        result['same_count_changed_projection_hash_refused'] = True
    else:
        raise AssertionError('Independent root comparison accepted a changed historical hash')
    print(json.dumps(result, sort_keys=True))
