const execSync = require('child_process').execSync;
const fs = require('fs');
const path = require('path');
const spawnSync = require('child_process').spawnSync;

function run() {
  const args = Array.from(arguments);
  console.log(args.join(' '));
  const command = args.shift();
  // spawn is safer and more lightweight than exec
  const ret = spawnSync(command, args, {stdio: 'inherit'});
  if (ret.status !== 0) {
    throw ret.error;
  }
}

function runUnsafe(command) {
  console.log(command);
  let env = Object.assign({}, process.env);
  env.HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK = '1';
  execSync(command, {stdio: 'inherit', env: env});
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

function isArm() {
  return process.arch == 'arm64';
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

function formulaPresent(formula) {
  const tapPrefix = process.arch == 'arm64' ? '/opt/homebrew' : '/usr/local/Homebrew';
  const tap = `${tapPrefix}/Library/Taps/homebrew/homebrew-core`;
  return fs.existsSync(`${tap}/Formula/${formula[0]}/${formula}.rb`) || fs.existsSync(`${tap}/Aliases/${formula}`);
}

function getDefaultVersion() {
  if (isMac() || process.env['ImageOS'] == 'win25') {
    return 17;
  } else if (process.env['ImageOS'] == 'ubuntu24') {
    return 16;
  } else {
    return 14;
  }
}

const defaultVersion = getDefaultVersion();
const postgresVersion = parseFloat(process.env['INPUT_POSTGRES-VERSION'] || defaultVersion);
if (![19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9.6].includes(postgresVersion)) {
  throw `Postgres version not supported: ${postgresVersion}`;
}

const database = process.env['INPUT_DATABASE'];

let bin;

if (isMac()) {
  const prefix = isArm() ? '/opt/homebrew' : '/usr/local';

  bin = `${prefix}/opt/postgresql@${postgresVersion}/bin`;
  let dataDir = `${prefix}/var/postgresql@${postgresVersion}`;

  if (!fs.existsSync(bin)) {
    if (fs.existsSync(`${prefix}/opt/postgresql@14`)) {
      // remove previous version
      run(`brew`, `unlink`, `postgresql@14`);
    }

    if (!formulaPresent(`postgresql@${postgresVersion}`)) {
      run(`brew`, `update`);
    }

    // install new version
    run(`brew`, `install`, `postgresql@${postgresVersion}`);
  }

  setConfig(dataDir);

  // start
  run(`${bin}/pg_ctl`, `-w`, `-D`, dataDir, `start`);
} else if (isWindows()) {
  const supportedVersion = process.env['ImageOS'] == 'win25' ? 17 : 14;
  if (postgresVersion != supportedVersion) {
    throw `Postgres version not supported on Windows: ${postgresVersion}`;
  }

  setConfig(process.env.PGDATA);

  // start
  run(`sc`, `config`, `postgresql-x64-${supportedVersion}`, `start=auto`);
  run(`net`, `start`, `postgresql-x64-${supportedVersion}`);

  bin = process.env.PGBIN;
} else {
  // removed in https://github.com/actions/virtual-environments/pull/3091
  if (!fs.existsSync('/etc/apt/sources.list.d/pgdg.list')) {
    // beta versions require extra component
    // development snapshots require this and -snapshot after pgdg
    // https://wiki.postgresql.org/wiki/Apt/FAQ
    const suffix = postgresVersion >= 18 ? ` ${postgresVersion}` : '';
    const snapshot = postgresVersion >= 19 ? `-snapshot` : '';
    runUnsafe(`curl -s https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/apt.postgresql.org.gpg >/dev/null`)
    runUnsafe(`echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg${snapshot} main${suffix}" | sudo tee /etc/apt/sources.list.d/pgdg.list`);
  }

  if (postgresVersion != defaultVersion || isArm()) {
    // remove previous cluster so port 5432 is used
    if (!isArm()) {
      run(`sudo`, `pg_dropcluster`, defaultVersion, `main`);

      if (postgresVersion < defaultVersion) {
        run(`sudo`, `apt-get`, `remove`, `postgresql-${defaultVersion}`);
      }
    }

    // install new version
    run(`sudo`, `apt-get`, `update`, `-o`, `Dir::Etc::sourcelist=sources.list.d/pgdg.list`, `-o`, `Dir::Etc::sourceparts=-`, `-o`, `APT::Get::List-Cleanup=0`);
    run(`sudo`, `apt-get`, `install`, `postgresql-${postgresVersion}`);
  }

  const devFiles = process.env['INPUT_DEV-FILES'];
  // maybe support other truthy values in future
  if (devFiles == 'true') {
    run(`sudo`, `apt-get`, `update`);
    run(`sudo`, `apt-get`, `install`, `postgresql-server-dev-${postgresVersion}`);
  }

  const dataDir = `/etc/postgresql/${postgresVersion}/main`;
  setConfig(dataDir);
  updateHba(dataDir);

  // start
  const startCmd = isArm() ? `restart` : `start`;
  run(`sudo`, `systemctl`, startCmd, `postgresql@${postgresVersion}-main`);

  // add user
  run(`sudo`, `-iu`, `postgres`, `createuser`, `-s`, process.env['USER']);

  bin = `/usr/lib/postgresql/${postgresVersion}/bin`;
}

if (database) {
  run(path.join(bin, 'createdb'), database);
}

addToPath(bin);
