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
    // remove previous version
    run(`brew unlink postgresql`);

    // install new version
    run(`brew install postgresql@${postgresVersion}`);
    dataDir += `@${postgresVersion}`;
    run(`${bin}/initdb --locale=C -E UTF-8 ${dataDir}`);
  }

  // start
  run(`${bin}/pg_ctl -D ${dataDir} start`);

  // set path
  run(`echo "${bin}" >> $GITHUB_PATH`);
} else {
  if (postgresVersion != 13) {
    // remove previous cluster so port 5432 is used
    run(`sudo pg_dropcluster 13 main`);

    // install new version
    run(`sudo apt-get install postgresql-${postgresVersion}`);
  }

  // start
  run(`sudo systemctl start postgresql@${postgresVersion}-main`);

  // add user
  run(`sudo -u postgres createuser -s $USER`);
}
