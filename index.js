const execSync = require('child_process').execSync;

function run(command) {
  console.log(command);
  execSync(command, {stdio: 'inherit'});
}

const postgresVersion = parseFloat(process.env['INPUT_POSTGRES-VERSION'] || 13);

if (![13, 12, 11, 10, 9.6].includes(postgresVersion)) {
  throw `Postgres version not supported: ${postgresVersion}`;
}

if (process.platform == 'darwin') {
  const bin = `/usr/local/opt/postgresql@${postgresVersion}/bin`;
  let dataDir = '/usr/local/var/postgres';
  if (postgresVersion != 13) {
    dataDir += `@${postgresVersion}`;
    run(`brew install postgresql@${postgresVersion}`);
    run(`${bin}/initdb --locale=C -E UTF-8 ${dataDir}`);
  }
  run(`${bin}/pg_ctl -D ${dataDir} start`);
} else {
  if (postgresVersion != 13) {
    run(`sudo pg_dropcluster 13 main`);
    run(`sudo apt-get install postgresql-${postgresVersion}`);
  }
  run(`sudo systemctl start postgresql@${postgresVersion}-main`);
  run(`sudo -u postgres createuser -s $USER`);
}
