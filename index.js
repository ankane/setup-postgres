const execSync = require('child_process').execSync;
const fs = require('fs');
const path = require('path');
const spawnSync = require('child_process').spawnSync;

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

// TODO read each line and replace existing value if needed
function setConfig(dir) {
  const config = process.env['INPUT_CONFIG'];
  if (config) {
    const file = path.join(dir, 'postgresql.conf');

    if (isMac() || isWindows()) {
      fs.appendFileSync(file, config);
    } else {
      const tmpfile = '/tmp/postgresql.conf';
      fs.writeFileSync(tmpfile, config);
      execSync(`cat ${tmpfile} | sudo tee -a ${file}`);
    }
  }
}

function updateHba(dir) {
  const contents = `
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   all             all                                     peer
host    all             $USER           127.0.0.1/32            trust
host    all             $USER           ::1/128                 trust
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
`
  execSync(`echo "${contents}" | sudo tee ${dir}/pg_hba.conf`);
}

const postgresVersion = parseFloat(process.env['INPUT_POSTGRES-VERSION'] || 13);
const database = process.env['INPUT_DATABASE'];

if (![13, 12, 11, 10, 9.6].includes(postgresVersion)) {
  throw `Postgres version not supported: ${postgresVersion}`;
}

let bin;

if (isMac()) {
  bin = `/usr/local/opt/postgresql@${postgresVersion}/bin`;
  let dataDir = '/usr/local/var/postgres';

  if (postgresVersion != 13) {
    // remove previous version
    run(`brew unlink postgresql`);

    // install new version
    run(`brew install postgresql@${postgresVersion}`);
    dataDir += `@${postgresVersion}`;
    run(`${bin}/initdb --locale=C -E UTF-8 ${dataDir}`);
  }

  setConfig(dataDir);

  // start
  run(`${bin}/pg_ctl -w -D ${dataDir} start`);

  addToPath(bin);
} else if (isWindows()) {
  if (postgresVersion != 13) {
    throw `Postgres version not supported on Windows: ${postgresVersion}`;
  }

  setConfig(process.env.PGDATA);

  // start
  run(`sc config postgresql-x64-13 start=auto`);
  run(`net start postgresql-x64-13`);

  bin = process.env.PGBIN;
} else {
  if (postgresVersion != 13) {
    // remove previous cluster so port 5432 is used
    run(`sudo pg_dropcluster 13 main`);

    // install new version
    run(`sudo apt-get update -o Dir::Etc::sourcelist="sources.list.d/pgdg.list" -o Dir::Etc::sourceparts="-" -o APT::Get::List-Cleanup="0"`);
    run(`sudo apt-get install postgresql-${postgresVersion}`);
  }

  const dataDir = `/etc/postgresql/${postgresVersion}/main`;
  setConfig(dataDir);
  updateHba(dataDir);

  // start
  run(`sudo systemctl start postgresql@${postgresVersion}-main`);

  // add user
  run(`sudo -u postgres createuser -s $USER`);

  bin = `/usr/lib/postgresql/${postgresVersion}/bin`;
}

addToPath(bin);

if (database) {
  // use spawnSync for escaping
  const ret = spawnSync(path.join(bin, "createdb"), [database], {stdio: 'inherit'});
  if (ret.status !== 0) {
    throw ret.error;
  }
}
