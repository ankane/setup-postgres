const execSync = require('child_process').execSync;
const fs = require('fs');
const path = require('path');
const spawnSync = require('child_process').spawnSync;

function run(command) {
  console.log(command);
  execSync(command, {stdio: 'inherit'});
}

function runSafe() {
  const args = Array.from(arguments);
  console.log(args.join(' '));
  const command = args.shift();
  // spawn is safer and more lightweight than exec
  const ret = spawnSync(command, args, {stdio: 'inherit'});
  if (ret.status !== 0) {
    throw ret.error;
  }
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

const defaultVersion = 14;
const postgresVersion = parseFloat(process.env['INPUT_POSTGRES-VERSION'] || defaultVersion);
if (![14, 13, 12, 11, 10].includes(postgresVersion)) {
  throw `Postgres version not supported: ${postgresVersion}`;
}

const database = process.env['INPUT_DATABASE'];

let bin;

if (isMac()) {
  bin = `/usr/local/opt/postgresql@${postgresVersion}/bin`;
  let dataDir = '/usr/local/var/postgres';

  if (postgresVersion != 14) {
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
} else if (isWindows()) {
  if (postgresVersion != 14) {
    throw `Postgres version not supported on Windows: ${postgresVersion}`;
  }

  setConfig(process.env.PGDATA);

  // start
  run(`sc config postgresql-x64-14 start=auto`);
  run(`net start postgresql-x64-14`);

  bin = process.env.PGBIN;
} else {
  // removed in https://github.com/actions/virtual-environments/pull/3091
  if (!fs.existsSync('/etc/apt/sources.list.d/pgdg.list')) {
    run(`wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add - 2> /dev/null`);
    run(`echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list`);
  }

  if (postgresVersion != 14) {
    // remove previous cluster so port 5432 is used
    run(`sudo pg_dropcluster 14 main`);

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

if (database) {
  runSafe(path.join(bin, "createdb"), database);
}

addToPath(bin);
