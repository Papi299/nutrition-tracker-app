"""Independent Python byte vectors for unreleased authority v2; no TS/SQL imports."""
import copy
import hashlib
import json
from pathlib import Path


def fingerprint(value):
    return hashlib.sha256(value.encode('utf8')).hexdigest()


def identity(number):
    return f'00000000-0000-4000-8000-{number:012d}'


legacy = json.loads(Path('tests/fixtures/foundation-mapping-contracts-v1.golden.json').read_text())
authority = dict(contract_version='foundation-mapping-actor-authority/v1', cluster_id=identity(20),
                 operator_principal_id=identity(21), operator_binding_id=identity(22),
                 operator_binding_hash=fingerprint('operator binding'), approver_principal_id=identity(23),
                 approver_binding_id=identity(24), approver_binding_hash=fingerprint('approver binding'))
bodies = [authority]
for vector in legacy['vectors'][2:]:
    body = copy.deepcopy(vector['body'])
    body['contract_version'] = body['contract_version'].replace('/v1', '/v2')
    body['actor_authority'] = copy.deepcopy(authority)
    bodies.append(body)
request = dict(id=identity(25), contract_version='foundation-actor-binding-request/v1', action='rebind',
               principal_id=identity(21), subject_hash=fingerprint('synthetic independent subject'), authority='operator',
               dataset_id=identity(1), environment='local', cluster_id=identity(20), login_oid=2001,
               login_name='synthetic_restored_operator', login_fingerprint=fingerprint('current catalog'),
               prior_binding_id=identity(22), requester_oid=2003, requester_name='synthetic_governor',
               requester_fingerprint=fingerprint('governor catalog'), evidence_hash=fingerprint('external evidence'),
               approval_reference='Synthetic continuity תזונה', requested_at='2026-10-31T00:00:00+00:00',
               not_before='2026-10-31T00:00:00+00:00', expires_at='2026-10-31T01:00:00+00:00')
bodies.append(request)
bodies.append(dict(id=identity(21), contract_version='foundation-actor-principal/v1', subject_hash=request['subject_hash'],
                   authority='operator', enrollment_request_id=identity(26), created_at='2026-10-31T00:00:00+00:00'))
bodies.append(dict(id=identity(27), contract_version='foundation-actor-binding-decision/v1', request_id=identity(25),
                   principal_id=identity(21), dataset_id=identity(1), environment='local', cluster_id=identity(20),
                   action='rebind', generation=2, prior_binding_id=identity(22), login_oid=2001,
                   login_name=request['login_name'], login_fingerprint=request['login_fingerprint'], requester_oid=2003,
                   requester_name='synthetic_governor', reviewer_oid=2004, reviewer_name='synthetic_reviewer',
                   evidence_hash=request['evidence_hash'], approval_reference=request['approval_reference'],
                   request_hash=fingerprint(json.dumps(request, ensure_ascii=False, sort_keys=True, separators=(',', ':'))),
                   decided_at='2026-10-31T00:01:00+00:00'))
bodies.append(dict(contract_version='foundation-mapping-governance-event/v2', plan_id=identity(9),
                   prior_state='prepared', next_state='validated', event_sequence=1, actor_oid=1001,
                   actor_principal_id=identity(21), actor_binding_id=identity(22), actor_binding_hash=authority['operator_binding_hash']))
vectors = []
for body in bodies:
    canonical = json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    vectors.append(dict(contract_version=body['contract_version'], body=body, canonical_bytes=canonical, sha256=fingerprint(canonical)))
Path('tests/fixtures/foundation-mapping-actor-v2.golden.json').write_text(json.dumps(dict(
    scope='Independent Python synthetic byte vectors; abbreviated operations are not executable. Original six historical vectors remain untouched.',
    vectors=vectors), ensure_ascii=False, indent=2) + '\n')
