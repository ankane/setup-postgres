const fs = require('fs');
const os = require('os');
const path = require('path');
const spawnSync = require('child_process').spawnSync;

function run() {
  const args = Array.from(arguments);
  console.log(args.map(v => v.toString().includes(' ') ? `"${v}"` : v).join(' '));
  const command = args.shift();
  let env = Object.assign({}, process.env);
  env.HOMEBREW_NO_AUTO_UPDATE = '1';
  env.HOMEBREW_NO_INSTALL_CLEANUP = '1';
  // spawn is safer and more lightweight than exec
  const ret = spawnSync(command, args, {stdio: 'inherit', env: env});
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
      spawnSync(`sudo`, [`tee`, `-a`, file], {input: config});
    }
  }
}

function updateHba(dir, user) {
  const contents = `
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             ${user}                                 trust
local   all             postgres                                peer
local   all             all                                     peer
host    all             ${user}         127.0.0.1/32            trust
host    all             ${user}         ::1/128                 trust
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
`;
  const file = path.join(dir, 'pg_hba.conf');

  if (isMac() || isWindows()) {
    fs.writeFileSync(file, contents);
  } else {
    spawnSync(`sudo`, [`tee`, file], {input: contents});
  }
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
const defaultUser = isWindows() ? 'postgres' : os.userInfo().username;
const user = process.env['INPUT_USER'] || defaultUser;
if (!/^[a-z0-9_-]+$/i.test(user)) {
  throw `Unsupported user: ${user}`;
}
const userExists = isMac() ? user == defaultUser : user == 'postgres';

let bin;
let cmdPrefix = [];

if (isMac()) {
  const prefix = isArm() ? '/opt/homebrew' : '/usr/local';

  bin = `${prefix}/opt/postgresql@${postgresVersion}/bin`;

  if (!fs.existsSync(bin)) {
    if (fs.existsSync(`${prefix}/opt/postgresql@14`)) {
      // remove previous version
      run(`brew`, `unlink`, `postgresql@14`);
    }

    if (!formulaPresent(`postgresql@${postgresVersion}`)) {
      run(`brew`, `update`, `--quiet`);
    }

    // install new version
    run(`brew`, `install`, `--quiet`, `postgresql@${postgresVersion}`);
  }

  // update config
  const dataDir = `${prefix}/var/postgresql@${postgresVersion}`;
  setConfig(dataDir);
  updateHba(dataDir, user);

  // start
  run(`${bin}/pg_ctl`, `-w`, `-D`, dataDir, `start`);
} else if (isWindows()) {
  if (isArm()) {
    throw `Windows ARM not supported`;
  }

  const supportedVersion = process.env['ImageOS'] == 'win25' ? 17 : 14;
  if (postgresVersion != supportedVersion) {
    throw `Postgres version not supported on Windows: ${postgresVersion}`;
  }

  // update config
  const dataDir = process.env.PGDATA;
  setConfig(dataDir);
  updateHba(dataDir, user);

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
    const suffix = postgresVersion >= 19 ? ` ${postgresVersion}` : '';
    const snapshot = postgresVersion >= 19 ? `-snapshot` : '';
    run(`sudo`, `install`, `-d`, `/usr/share/postgresql-common/pgdg`);
    run(`sudo`, `cp`, path.join(__dirname, `keys`, `ACCC4CF8.asc`), `/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc`);
    const codename =  spawnSync(`lsb_release`, [`-cs`], {encoding: 'utf-8'}).stdout.trim();
    const pgdgList = `deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${codename}-pgdg${snapshot} main${suffix}\n`;
    spawnSync(`sudo`, [`tee`, `/etc/apt/sources.list.d/pgdg.list`], {input: pgdgList});
  }

  if (postgresVersion != defaultVersion || isArm()) {
    // remove previous cluster so port 5432 is used
    if (!isArm()) {
      run(`sudo`, `pg_dropcluster`, defaultVersion, `main`);

      if (postgresVersion < defaultVersion) {
        run(`sudo`, `apt-get`, `-qq`, `-o`, `Dpkg::Use-Pty=0`, `remove`, `postgresql-${defaultVersion}`);
      }
    }

    // install new version
    run(`sudo`, `apt-get`, `-qq`, `update`, `-o`, `Dir::Etc::sourcelist=sources.list.d/pgdg.list`, `-o`, `Dir::Etc::sourceparts=-`, `-o`, `APT::Get::List-Cleanup=0`);
    run(`sudo`, `apt-get`, `-qq`, `-o`, `Dpkg::Use-Pty=0`, `install`, `postgresql-${postgresVersion}`);
  }

  const devFiles = process.env['INPUT_DEV-FILES'];
  // maybe support other truthy values in future
  if (devFiles == 'true') {
    run(`sudo`, `apt-get`, `-qq`, `update`);
    run(`sudo`, `apt-get`, `-qq`, `-o`, `Dpkg::Use-Pty=0`, `install`, `postgresql-server-dev-${postgresVersion}`);
  }

  // update config
  const dataDir = `/etc/postgresql/${postgresVersion}/main`;
  setConfig(dataDir);
  updateHba(dataDir, user);

  // start
  const startCmd = isArm() ? `restart` : `start`;
  run(`sudo`, `systemctl`, startCmd, `postgresql@${postgresVersion}-main`);

  bin = `/usr/lib/postgresql/${postgresVersion}/bin`;
  cmdPrefix = [`sudo`, `-iu`, `postgres`];
}

if (!userExists) {
  run(...cmdPrefix, path.join(bin, 'createuser'), `-s`, user);
}

if (database) {
  run(path.join(bin, 'createdb'), '-U', user, database);
}

addToPath(bin);
