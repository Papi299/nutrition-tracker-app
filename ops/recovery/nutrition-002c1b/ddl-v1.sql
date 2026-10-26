-- Disposable local supplement to the immutable 002C model. No hosted installer.
begin;
set local role nutrition_recovery_owner;
create table recovery_ops.ddl_admissions (
  attempt_id uuid primary key references recovery_ops.attempts(attempt_id),
  protocol text not null check(protocol='nutrition-002c1b-ddl-stability/v1'),
  source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$')
);
alter table recovery_ops.ddl_admissions enable row level security;
revoke all on recovery_ops.ddl_admissions from public;

create function recovery_ops.ddl_admit(p_id uuid,p_operation text,p_boundary integer,p_source text,p_protocol text,p_seconds integer)
returns bigint language plpgsql security invoker set search_path='' as $$
declare e bigint;
begin
  perform recovery_ops.require_lock();
  if p_protocol is distinct from 'nutrition-002c1b-ddl-stability/v1' then
    raise exception 'N002C1B_PROTOCOL_DENIED' using errcode='55000';
  end if;
  e := recovery_ops.admit(p_id,p_operation,p_boundary,p_source,p_seconds);
  insert into recovery_ops.ddl_admissions values(p_id,p_protocol,p_source);
  return e;
end $$;

create function recovery_ops.ddl_check(p_id uuid,p_epoch bigint,p_operation text,p_source text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform recovery_ops.require_lock();
  perform 1 from recovery_ops.control c join recovery_ops.attempts a using(attempt_id,epoch)
    join recovery_ops.ddl_admissions d using(attempt_id)
    join pg_catalog.pg_stat_activity s on s.pid=a.owner_pid and s.backend_start=a.owner_backend_start
    where c.singleton and c.attempt_id=p_id and c.epoch=p_epoch and a.operation=p_operation
      and c.state=case when p_operation='BACKUP' then 'CAPTURING' when p_operation='MIGRATION' then 'MIGRATING' end
      and a.state=c.state and a.owner_pid=pg_catalog.pg_backend_pid() and a.deadline>clock_timestamp()
      and c.expected_source=p_source and a.source_sha256=p_source and d.source_sha256=p_source
      and d.protocol='nutrition-002c1b-ddl-stability/v1';
  if not found then raise exception 'N002C1B_OPERATION_DENIED' using errcode='55000'; end if;
end $$;

-- Only exact outcomes for the admitted operation. The old reconciler additionally
-- requires owner AND every registered participant backend to be absent. There is
-- no TTL reset or automatic takeover. Client-process reconciliation is also needed.
create function recovery_ops.ddl_reconcile(p_id uuid,p_epoch bigint,p_outcome text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_outcome is null or not exists(select 1 from recovery_ops.attempts a
    join recovery_ops.ddl_admissions d using(attempt_id) where a.attempt_id=p_id and a.epoch=p_epoch
      and ((a.operation='BACKUP' and p_outcome in ('DISCARDED','VERIFIED_LOCAL_ARTIFACT'))
        or (a.operation='MIGRATION' and p_outcome='MIGRATION_READBACK_REVIEWED'))) then
    raise exception 'N002C1B_TERMINAL_DENIED' using errcode='55000';
  end if;
  perform recovery_ops.reconcile(p_id,p_epoch,p_outcome);
end $$;
revoke all on all functions in schema recovery_ops from public;
reset role;
commit;
