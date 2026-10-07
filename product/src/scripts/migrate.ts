import { PostgresService } from '../infra/postgres/postgres.service';
import { Migrator, loadMigrations } from '../infra/postgres/migrator';

/** CLI: `npm run migrate:up` / `npm run migrate:down [steps]` (T3-02, T3-08). */
async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'up';
  const db = new PostgresService();
  const migrator = new Migrator(db, loadMigrations());
  try {
    if (cmd === 'up') {
      const ran = await migrator.up();
      console.log(ran.length ? `applied: ${ran.join(', ')}` : 'up to date');
    } else if (cmd === 'down') {
      const steps = Number(process.argv[3] ?? 1);
      const rolled = await migrator.down(steps);
      console.log(rolled.length ? `rolled back: ${rolled.join(', ')}` : 'nothing to roll back');
    } else {
      console.error('usage: migrate [up|down [steps]]');
      process.exitCode = 1;
    }
  } finally {
    await db.onModuleDestroy();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
