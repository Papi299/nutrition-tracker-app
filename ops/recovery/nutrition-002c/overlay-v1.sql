-- PROPOSED LOCAL REFERENCE ONLY. Not an application migration or hosted installer.
-- Install once into a fresh disposable database, as its bootstrap administrator.
begin;
create role nutrition_recovery_owner nologin noinherit;
create schema recovery_ops authorization nutrition_recovery_owner;
set local role nutrition_recovery_owner;

create table recovery_ops.control (
  singleton boolean primary key default true check (singleton),
  overlay_version text not null check (overlay_version = 'nutrition-002c-overlay/v1'),
  expected_source text check (expected_source ~ '^[a-f0-9]{64}$'),
  epoch bigint not null default 0 check (epoch >= 0),
  state text not null check (state in ('IDLE','CAPTURING','SEALED','MIGRATING','RECONCILIATION_REQUIRED')),
  attempt_id uuid,
  reconciliation text not null,
  observed_at timestamptz not null default clock_timestamp()
);
insert into recovery_ops.control(singleton,overlay_version,state,reconciliation)
values (true,'nutrition-002c-overlay/v1','RECONCILIATION_REQUIRED','FRESH_INSTALL_REQUIRES_LOCAL_REVIEW');

create table recovery_ops.attempts (
  attempt_id uuid primary key,
  epoch bigint not null unique,
  operation text not null check (operation in ('BACKUP','MIGRATION')),
  protocol text not null check (protocol = 'nutrition-002c-local/v1'),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  boundary integer not null check (boundary in (44,45)),
  state text not null check (state in ('CAPTURING','SEALED','MIGRATING','RECONCILIATION_REQUIRED')),
  owner_pid integer not null,
  owner_backend_start timestamptz not null,
  started_at timestamptz not null default clock_timestamp(),
  last_observed_at timestamptz not null default clock_timestamp(),
  deadline timestamptz not null,
  terminal_at timestamptz,
  artifact_sha256 text check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  reconciliation text not null default 'UNRESOLVED',
  check (deadline > started_at)
);
create table recovery_ops.participants (
  attempt_id uuid not null references recovery_ops.attempts(attempt_id),
  label text not null check (label in ('schema','application','auth','reference')),
  application_name text not null unique check (application_name ~ '^n002c_[a-f0-9]{32}_(schema|application|auth|reference)$'),
  client_pid integer check (client_pid > 0),
  backend_pid integer,
  backend_start timestamptz,
  state text not null check (state in ('REGISTERED','RUNNING','STOPPED')),
  registered_at timestamptz not null default clock_timestamp(),
  last_observed_at timestamptz not null default clock_timestamp(),
  stopped_at timestamptz,
  output_sha256 text check (output_sha256 ~ '^[a-f0-9]{64}$'),
  primary key(attempt_id,label)
);
create table recovery_ops.gate (
  singleton boolean primary key default true check (singleton),
  closed boolean not null default true,
  reason text not null,
  changed_at timestamptz not null default clock_timestamp()
);
insert into recovery_ops.gate values(true,true,'FRESH_INSTALL_CLOSED',clock_timestamp());
create table recovery_ops.gated_tables (
  schema_name name not null,
  table_name name not null,
  primary key(schema_name,table_name)
);

alter table recovery_ops.control enable row level security;
alter table recovery_ops.attempts enable row level security;
alter table recovery_ops.participants enable row level security;
alter table recovery_ops.gate enable row level security;
alter table recovery_ops.gated_tables enable row level security;
revoke all on schema recovery_ops from public;
revoke all on all tables in schema recovery_ops from public;
alter default privileges in schema recovery_ops revoke execute on functions from public;

create function recovery_ops.require_lock() returns void
language plpgsql security invoker set search_path='' as $$
begin
  if not exists (select 1 from pg_catalog.pg_locks where pid=pg_catalog.pg_backend_pid()
    and locktype='advisory' and classid=2002003 and objid=1 and objsubid=2 and granted) then
    raise exception 'N002C_LOCK_REQUIRED' using errcode='55000';
  end if;
end $$;

create function recovery_ops.admit(p_id uuid,p_operation text,p_boundary integer,p_source text,p_seconds integer)
returns bigint language plpgsql security invoker set search_path='' as $$
declare c recovery_ops.control; e bigint; b timestamptz;
begin
  perform recovery_ops.require_lock();
  select * into strict c from recovery_ops.control where singleton for update;
  if c.state <> 'IDLE' or c.attempt_id is not null or c.expected_source is distinct from p_source
    or p_operation not in ('BACKUP','MIGRATION') or p_boundary not in (44,45)
    or (p_operation='MIGRATION' and (p_boundary<>44 or
      (select closed from recovery_ops.gate where singleton) is distinct from true))
    or p_seconds not between 1 and 300 then
    raise exception 'N002C_ADMISSION_DENIED' using errcode='55000';
  end if;
  e := c.epoch+1;
  select backend_start into strict b from pg_catalog.pg_stat_activity where pid=pg_catalog.pg_backend_pid();
  insert into recovery_ops.attempts(attempt_id,epoch,operation,protocol,source_sha256,boundary,state,owner_pid,owner_backend_start,deadline)
    values(p_id,e,p_operation,'nutrition-002c-local/v1',p_source,p_boundary,
      case when p_operation='BACKUP' then 'CAPTURING' else 'MIGRATING' end,
      pg_catalog.pg_backend_pid(),b,clock_timestamp()+pg_catalog.make_interval(secs=>p_seconds));
  update recovery_ops.control set epoch=e,attempt_id=p_id,
    state=case when p_operation='BACKUP' then 'CAPTURING' else 'MIGRATING' end,
    reconciliation='UNRESOLVED',observed_at=clock_timestamp() where singleton;
  return e;
end $$;

create function recovery_ops.register(p_id uuid,p_epoch bigint,p_label text,p_name text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  -- Called on a separate control connection while the owner is in READ ONLY.
  perform 1 from recovery_ops.control c join recovery_ops.attempts a using(attempt_id,epoch)
    where c.singleton and c.attempt_id=p_id and c.epoch=p_epoch and c.state='CAPTURING'
      and a.deadline>clock_timestamp()
      and exists(select 1 from pg_catalog.pg_stat_activity s where s.pid=a.owner_pid and s.backend_start=a.owner_backend_start)
    for update of c;
  if not found or p_name <> 'n002c_'||replace(p_id::text,'-','')||'_'||p_label then
    raise exception 'N002C_REGISTRATION_DENIED' using errcode='55000';
  end if;
  insert into recovery_ops.participants(attempt_id,label,application_name,state)
    values(p_id,p_label,p_name,'REGISTERED');
end $$;

create function recovery_ops.fail_attempt(p_id uuid,p_epoch bigint) returns void
language plpgsql security invoker set search_path='' as $$
begin
  update recovery_ops.control set state='RECONCILIATION_REQUIRED',reconciliation='UNRESOLVED',observed_at=clock_timestamp()
    where singleton and attempt_id=p_id and epoch=p_epoch and state in ('CAPTURING','MIGRATING');
  if not found then raise exception 'N002C_STALE_ATTEMPT' using errcode='55000'; end if;
  update recovery_ops.attempts set state='RECONCILIATION_REQUIRED',last_observed_at=clock_timestamp()
    where attempt_id=p_id and epoch=p_epoch;
end $$;

create function recovery_ops.seal(p_id uuid,p_epoch bigint,p_hash text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  perform recovery_ops.require_lock();
  perform 1 from recovery_ops.control c join recovery_ops.attempts a using(attempt_id,epoch)
    where c.singleton and c.attempt_id=p_id and c.epoch=p_epoch and c.state='CAPTURING'
      and a.owner_pid=pg_catalog.pg_backend_pid() and a.deadline>clock_timestamp()
      and (select count(*) from recovery_ops.participants p where p.attempt_id=p_id)=4
      and not exists(select 1 from recovery_ops.participants p where p.attempt_id=p_id and
        (p.state<>'STOPPED' or p.output_sha256 is null or exists
          (select 1 from pg_catalog.pg_stat_activity s where s.application_name=p.application_name)))
    for update of c;
  if not found or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'N002C_SEAL_DENIED' using errcode='55000';
  end if;
  update recovery_ops.attempts set state='SEALED',artifact_sha256=p_hash,terminal_at=clock_timestamp(),
    last_observed_at=clock_timestamp() where attempt_id=p_id and epoch=p_epoch;
  update recovery_ops.control set state='SEALED',observed_at=clock_timestamp() where singleton;
end $$;

create function recovery_ops.reconcile(p_id uuid,p_epoch bigint,p_outcome text) returns void
language plpgsql security invoker set search_path='' as $$
declare a recovery_ops.attempts;
begin
  perform recovery_ops.require_lock();
  perform 1 from recovery_ops.control where singleton and attempt_id=p_id and epoch=p_epoch
    and state in ('CAPTURING','SEALED','MIGRATING','RECONCILIATION_REQUIRED') for update;
  if not found or p_outcome not in ('DISCARDED','VERIFIED_LOCAL_ARTIFACT','MIGRATION_READBACK_REVIEWED') then
    raise exception 'N002C_RECONCILIATION_DENIED' using errcode='55000';
  end if;
  select * into strict a from recovery_ops.attempts where attempt_id=p_id and epoch=p_epoch;
  if exists(select 1 from pg_catalog.pg_stat_activity s where
    (s.pid=a.owner_pid and s.backend_start=a.owner_backend_start)
    or s.application_name in (select application_name from recovery_ops.participants where attempt_id=p_id)) then
    raise exception 'N002C_BACKEND_STILL_PRESENT' using errcode='55000';
  end if;
  if (p_outcome='VERIFIED_LOCAL_ARTIFACT' and (a.state<>'SEALED' or a.artifact_sha256 is null))
    or (a.operation='MIGRATION' and p_outcome<>'MIGRATION_READBACK_REVIEWED') then
    raise exception 'N002C_OUTCOME_MISMATCH' using errcode='55000';
  end if;
  update recovery_ops.attempts set reconciliation=p_outcome,terminal_at=coalesce(terminal_at,clock_timestamp()),
    last_observed_at=clock_timestamp() where attempt_id=p_id and epoch=p_epoch;
  update recovery_ops.control set state='IDLE',attempt_id=null,reconciliation=p_outcome,observed_at=clock_timestamp()
    where singleton;
end $$;

create function recovery_ops.enforce_gate() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_closed boolean;
begin
  perform 1 from recovery_ops.control where singleton and overlay_version='nutrition-002c-overlay/v1'
    and expected_source is not null;
  if not found then raise exception 'N002C_APPLICATION_CONTROL_MISSING' using errcode='55000'; end if;
  select closed into strict v_closed from recovery_ops.gate where singleton for share;
  if v_closed then raise exception 'N002C_APPLICATION_GATE_CLOSED' using errcode='55000'; end if;
  return null;
end $$;

create function recovery_ops.guard_attempt_update() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if (new.attempt_id,new.epoch,new.operation,new.protocol,new.source_sha256,new.boundary,
      new.owner_pid,new.owner_backend_start,new.started_at,new.deadline) is distinct from
     (old.attempt_id,old.epoch,old.operation,old.protocol,old.source_sha256,old.boundary,
      old.owner_pid,old.owner_backend_start,old.started_at,old.deadline)
    or not (new.state=old.state
      or (old.state='CAPTURING' and new.state in ('SEALED','RECONCILIATION_REQUIRED'))
      or (old.state='MIGRATING' and new.state='RECONCILIATION_REQUIRED'))
    or (old.artifact_sha256 is not null and new.artifact_sha256 is distinct from old.artifact_sha256)
    or (old.terminal_at is not null and new.terminal_at is distinct from old.terminal_at) then
    raise exception 'N002C_ILLEGAL_ATTEMPT_TRANSITION' using errcode='55000';
  end if;
  return new;
end $$;
create trigger immutable_attempt before update on recovery_ops.attempts
for each row execute function recovery_ops.guard_attempt_update();

-- No client EXECUTE or USAGE grants. Trigger invocation needs neither. This
-- owner has no application-table privileges, role memberships or login.
revoke all on all functions in schema recovery_ops from public;
reset role;
commit;
