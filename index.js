const execSync = require('child_process').execSync;
const fs = require('fs');
const path = require('path');

function run(command) {
  console.log(command);
  execSync(command, {stdio: 'inherit'});
}

function addToPath(newPath) {
  fs.appendFileSync(process.env.GITHUB_PATH, `${newPath}\n`);
}

function isMac() {
  return process.platform == 'darwin';
}

function isWindows() {
  return process.platform == 'win32';
}

function enablePgStatStatements(dir) {
  const file = path.join(dir, 'postgresql.conf');
  const contents = `shared_preload_libraries = 'pg_stat_statements'\n`;

  if (isMac() || isWindows()) {
    fs.appendFileSync(file, contents);
  } else {
    execSync(`echo "${contents}" | sudo tee -a ${file}`);
  }
}

const postgresVersion = parseFloat(process.env['INPUT_POSTGRES-VERSION'] || 13);

if (![13, 12, 11, 10, 9.6].includes(postgresVersion)) {
  throw `Postgres version not supported: ${postgresVersion}`;
}

if (isMac()) {
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

  enablePgStatStatements(dataDir);

  // start
  run(`${bin}/pg_ctl -D ${dataDir} start`);

  addToPath(bin);
} else if (isWindows()) {
  if (postgresVersion != 13) {
    throw `Postgres version not supported on Windows: ${postgresVersion}`;
  }

  enablePgStatStatements(process.env.PGDATA);

  // start
  run(`sc config postgresql-x64-13 start=auto`);
  run(`net start postgresql-x64-13`);

  addToPath(process.env.PGBIN);
} else {
  if (postgresVersion != 13) {
    // remove previous cluster so port 5432 is used
    run(`sudo pg_dropcluster 13 main`);

    // install new version
    run(`sudo apt-get install postgresql-${postgresVersion}`);
  }

  enablePgStatStatements(`/etc/postgresql/${postgresVersion}/main`);

  // start
  run(`sudo systemctl start postgresql@${postgresVersion}-main`);

  // add user
  run(`sudo -u postgres createuser -s $USER`);

  addToPath(`/usr/lib/postgresql/${postgresVersion}/bin`);
}
