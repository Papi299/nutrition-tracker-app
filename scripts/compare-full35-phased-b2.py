#!/usr/bin/env python3
"""Compare only retained sanitized observations with a local JSON snapshot.

No database/network/credential interface. Unobserved fields never become PASS.
"""
import argparse, gzip, hashlib, json, pathlib, zipfile

GROUPS={
 'relations':('Q01','relations',('schema','name','kind')),
 'ledger_columns':('Q01','migration_columns',('name',)),
 'selected_columns':('Q02','columns',('schema','table','column')),
 'extensions':('Q02','extensions',('schema','name')),
 'tables':('Q03','tables',('schema','name')),
 'functions':('Q03','functions',('schema','name','args')),
 'roles':('Q03','roles',('name',)),
 'default_acls':('Q03','default_acls',('schema','owner','type')),
 'schemas':('Q05','schemas',('name',)),
 'policies':('Q05','policies',('schema','table','name')),
 'triggers':('Q05','triggers',('schema','table','name')),
 'expected_role_memberships':('Q05','expected_role_memberships',('role',)),
 'columns_and_defaults':('Q06','columns',('schema','table','column')),
 'constraints':('Q06','constraints',('schema','table','name')),
 'relevant_constraint_text':('Q07','relevant_constraints',('schema','table','name')),
}
GAPS=[
 {'id':'B2-INDEX-VIEW','missing':'Index definitions/validity/predicates/expressions and view/materialized-view definitions, owners, options and ACLs were not captured. Constraint-backed index identity alone does not cover independent indexes.'},
 {'id':'B2-COLUMN-DETAIL','missing':'Column collation, identity/generated attributes, storage/compression and attribute order were not all retained. Defaults are hashes; differing hashes require canonical expressions.'},
 {'id':'B2-TABLE-DETAIL','missing':'Full table persistence/partition/inheritance/options and sequence definitions/ownership were not retained.'},
 {'id':'B2-ROLE-EDGES','missing':'Only five expected ingestion membership paths and aggregate counts were retained. Full member/grantor identities and every relevant transitive membership edge need stable sanitized identifiers plus admin/inherit/set options; no login passwords.'},
 {'id':'B2-ACL-EFFECTIVE','missing':'Stored table/column/default ACLs are retained; complete effective mutation privileges through all inherited roles and global default ACL owner/schema scope require the full membership graph and canonical grant expansion.'},
 {'id':'B2-HASH-DIFFERENCES','missing':'Canonical expressions/definitions only for the exact differing defaults, constraints or trigger/function definitions listed in this comparison; hashes cannot establish semantic equivalence.'},
 {'id':'B2-FRESHNESS','missing':'All retained hosted observations are dated. Refresh exact baseline/objects and bounded relevant configuration at the future authorized release preflight; no owner data is needed.'},
]
def canonical(x):return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def collect(archive):
    with zipfile.ZipFile(archive) as z:
        def read(name):
            matches=[n for n in z.namelist() if n.endswith('/'+name)];assert len(matches)==1
            return json.loads(z.read(matches[0]))
        root=read('database-evidence.json')
        result={q['id']:q['result'][0]['preflight'] for q in root['queries']}
        for name in ['database-q06.json','database-q07.json']:
            q=read(name);result[q['id']]=q['result'][0]['preflight']
        return result
def acl_entries(text):
    import re
    if not isinstance(text,str) or not text.startswith('{') or not text.endswith('}') or '"' in text:return None
    out=set()
    for entry in text[1:-1].split(','):
        m=re.fullmatch(r'([A-Za-z_0-9]*)=([A-Za-z*]*)/([A-Za-z_0-9]+)',entry)
        if not m:return None
        role,privileges,grantor=m.groups();i=0
        while i<len(privileges):
            privilege=privileges[i];option=i+1<len(privileges) and privileges[i+1]=='*'
            out.add((role,grantor,privilege,option));i+=2 if option else 1
    return out
def diff(group,remote,local,keys):
    if remote is None or local is None:
        return {'hostedObjects':None if remote is None else len(remote),'localObjects':None if local is None else len(local),
          'exactObjects':0,'differences':[{'kind':'UNOBSERVED_METADATA','hostedMissing':remote is None,'localMissing':local is None}],
          'status':'UNOBSERVED_METADATA'}
    def index(rows):
        indexed={}
        for row in rows or []:
            key=canonical([row.get(k) for k in keys]);assert key not in indexed,'Duplicate identity in '+group
            indexed[key]=row
        return indexed
    a,b=index(remote),index(local);equal=0;changes=[]
    for key in sorted(set(a)|set(b)):
        if key not in a:changes.append({'identity':json.loads(key),'kind':'LOCAL_ONLY','local':b[key]});continue
        if key not in b:changes.append({'identity':json.loads(key),'kind':'HOSTED_ONLY','hosted':a[key]});continue
        if a[key]==b[key]:equal+=1;continue
        for field in sorted(set(a[key])|set(b[key])):
            if a[key].get(field)!=b[key].get(field):
                category='UNRESOLVED_OBJECT_DIFFERENCE'
                if group in ('roles','default_acls','schemas','extensions','ledger_columns'):category='PROVIDER_OR_BOOTSTRAP_DIFFERENCE_REQUIRES_REVIEW'
                elif field.endswith('_sha256'):category='DEFINITION_HASH_DIFFERENCE_REQUIRES_CANONICAL_TEXT'
                if field=='acl':
                    hosted_acl,local_acl=acl_entries(a[key].get(field)),acl_entries(b[key].get(field))
                    if hosted_acl is not None and local_acl is not None:
                        if hosted_acl==local_acl:category='ACL_ORDER_ONLY_RAW_RECOVERY_FINGERPRINT_STILL_DIFFERS'
                        elif hosted_acl<local_acl and all(e[0]=='service_role' for e in local_acl-hosted_acl):category='HOSTED_STRICTER_SERVICE_ROLE_PRIVILEGES_PRESERVE_HOSTED_POLICY'
                        elif hosted_acl<local_acl:category='HOSTED_STRICTER_DEFAULT_PRIVILEGES_PRESERVE_HOSTED_POLICY'
                if field=='service_role_execute' and a[key].get(field) is False and b[key].get(field) is True:category='HOSTED_STRICTER_SERVICE_ROLE_EXECUTION_PRESERVE_HOSTED_POLICY'
                changes.append({'identity':json.loads(key),'kind':'FIELD_DIFFERENCE','field':field,'hosted':a[key].get(field),'local':b[key].get(field),'classification':category})
    return {'hostedObjects':len(a),'localObjects':len(b),'exactObjects':equal,'differences':changes,
      'status':'MATCH_RETAINED_FIELDS' if not changes else 'REVIEW_REQUIRED'}
def compare(remote,local):
    groups={name:diff(name,remote.get(q,{}).get(field),local.get(q,{}).get(field),keys)
      for name,(q,field,keys) in GROUPS.items()}
    for q,field in [('Q07','grant_paths'),('Q05','settings')]:
        a=remote[q].get(field);b=local[q].get(field)
        changes=[]
        if field=='settings':
            for key in sorted(set(a)|set(b)):
                for attribute in sorted(set(a.get(key,{}) or {})|set(b.get(key,{}) or {})):
                    av,bv=a.get(key,{}).get(attribute),b.get(key,{}).get(attribute)
                    if av!=bv:changes.append({'setting':key,'field':attribute,'hosted':av,'local':bv,'classification':'PROVIDER_CONFIGURATION_REQUIRES_BUDGET_REVIEW'})
        elif a!=b:changes=[{'classification':'SANITIZED_EDGE_REQUIRES_REVIEW','hosted':a,'local':b}]
        groups[field]={'hosted':a,'local':b,'differences':changes,'status':'MATCH_RETAINED_FIELDS' if not changes else 'REVIEW_REQUIRED'}
    groups['role_timeout_settings']=diff('role_timeout_settings',remote['Q05'].get('role_timeout_settings'),local['Q05'].get('role_timeout_settings'),('role','setting'))
    groups['database_timeout_settings']={'hosted':remote['Q05'].get('database_timeout_settings'),'local':local['Q05'].get('database_timeout_settings'),
      'status':'UNCOMPARABLE_WITHOUT_STABLE_PRINCIPAL_BINDINGS','differences':[{'classification':'CROSS_CLUSTER_ROLE_OIDS_NOT_PORTABLE','statement':'All retained rows require stable role/database binding before semantic comparison; no mismatch waiver or guessed identity.'}]}
    # SQL source custody is separate from how a CLI splits source into statements.
    # Keep every packing difference visible rather than treating it as schema drift.
    groups['migration_statements']=diff('migration_statements',remote['Q06']['migration_statement_fingerprints'],
      local['Q06']['migration_statement_fingerprints'],('version',))
    for item in groups['migration_statements']['differences']:item['classification']='LEDGER_SOURCE_PACKING_OR_PROVENANCE_DIFFERENCE_NOT_WHOLE_SCHEMA_PROOF'
    missing=[g for g in GAPS if g['id']!='B2-HASH-DIFFERENCES' or any(d.get('classification')=='DEFINITION_HASH_DIFFERENCE_REQUIRES_CANONICAL_TEXT' for group in groups.values() for d in group.get('differences',[]))]
    return {'scope':'Retained Stage 6B metadata versus exact local 46 replay; no hosted query',
      'result':'B2_REMAINS_OPEN_TARGETED_OBSERVATIONS','groups':groups,'missingObservations':missing,
      'runtimeObservationsExcluded':['observed_at','activity','locks','inspection statement/lock timeout overrides','synthetic versus real dataset identities/rows'],
      'statement':'A match covers only retained fields. All differences remain review items; provider labels do not waive a security or recovery gate.'}
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--archive',type=pathlib.Path,required=True);p.add_argument('--local',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);a=p.parse_args()
    local=json.loads(gzip.decompress(a.local.read_bytes()))
    result=compare(collect(a.archive),local);result['inputs']={'archiveSha256':hashlib.sha256(a.archive.read_bytes()).hexdigest(),'localSha256':hashlib.sha256(a.local.read_bytes()).hexdigest()}
    a.output.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({name:{'status':v['status'],'differences':len(v.get('differences',[])),'exactObjects':v.get('exactObjects')} for name,v in result['groups'].items()}))
if __name__=='__main__':main()
