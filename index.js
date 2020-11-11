const execSync = require("child_process").execSync;

function run(command) {
  console.log(command);
  execSync(command, {stdio: 'inherit'});
}

const postgresVersion = parseFloat(process.env['INPUT_POSTGRES-VERSION'] || 13);

if (process.platform == 'darwin') {
  if (postgresVersion != 13) {
    run('rm -rf /usr/local/var/postgres');
    run('brew install postgresql@' + postgresVersion);
  }
  run('brew services start postgresql@' + postgresVersion);
  run('sleep 10');
} else {
  if (postgresVersion != 13) {
    run('sudo pg_dropcluster 13 main');
    run('sudo apt-get install postgresql-' + postgresVersion);
  }
  run('sudo systemctl start postgresql@' + postgresVersion + '-main');
  run('sudo -u postgres createuser -s $USER');
}
