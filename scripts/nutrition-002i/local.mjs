import { Environment as MailEnvironment } from '../nutrition-002g/mail-local.mjs';
import { run } from '../nutrition-002g/process.mjs';
import { assertEqual } from '../nutrition-002g/contract.mjs';

export class Environment extends MailEnvironment {
  constructor(side) { super(side, '002i'); }

  // This is the only SQL transport used by the adapter. The inherited
  // administrative transport belongs exclusively to disposable fixture setup.
  async roleSql(input) {
    await this.check('db');
    return run('docker', ['exec', '-i', this.ids.get('db'), 'psql',
      '-XqAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate',
      '-U', 'postgres', '-d', 'postgres'], {
        input:"set statement_timeout='30s';set lock_timeout='2s';set search_path=pg_catalog;\n"+input,
        timeoutMs: 30000,
      });
  }

  async restrictRole() {
    await this.sql(`
      alter role postgres nosuperuser bypassrls;
      grant pg_read_all_data to postgres;
      revoke set on parameter session_replication_role from postgres;
      grant ingestion_operator,ingestion_approver,ingestion_definer,
        ingestion_promotion_definer,ingestion_lifecycle_definer to postgres
        with admin true, inherit false, set false;
    `);
    assertEqual(await this.roleSql('select current_user;'), 'postgres', 'ROLE_TRANSPORT');
  }
}
