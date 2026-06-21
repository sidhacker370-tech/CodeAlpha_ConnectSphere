const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const reportPath = path.join(__dirname, 'health-report.json');
const health = {
  timestamp: new Date().toISOString(),
  serverCompile: 'PENDING',
  clientCompile: 'PENDING',
  serverOnline: 'PENDING',
  databaseExists: 'PENDING',
  errors: []
};

// 1. Check Server compilation
try {
  console.log('Running server type check...');
  execSync('npx tsc --noEmit', { cwd: path.join(__dirname, '../server'), stdio: 'pipe' });
  health.serverCompile = 'SUCCESS';
} catch (error) {
  health.serverCompile = 'FAILED';
  health.errors.push({ component: 'Server Compile', message: error.stdout?.toString() || error.message });
}

// 2. Check Client compilation
try {
  console.log('Running client type check...');
  execSync('npx tsc --noEmit', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
  health.clientCompile = 'SUCCESS';
} catch (error) {
  health.clientCompile = 'FAILED';
  health.errors.push({ component: 'Client Compile', message: error.stdout?.toString() || error.message });
}

// 3. Check Local Database File
try {
  const dbPath = path.join(__dirname, '../server/prisma/dev.db');
  if (fs.existsSync(dbPath)) {
    health.databaseExists = 'SUCCESS';
  } else {
    health.databaseExists = 'MISSING';
    health.errors.push({ component: 'Database Check', message: 'SQLite database file (dev.db) is missing.' });
  }
} catch (error) {
  health.databaseExists = 'FAILED';
  health.errors.push({ component: 'Database Check', message: error.message });
}

// 4. Check if Backend server is responsive
const checkServer = () => {
  return new Promise((resolve) => {
    console.log('Checking backend server port 5000...');
    const req = http.get('http://localhost:5000/', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          health.serverOnline = 'SUCCESS';
        } else {
          health.serverOnline = 'UNHEALTHY';
          health.errors.push({ component: 'Server Ping', message: `Server responded with status code ${res.statusCode}` });
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      health.serverOnline = 'OFFLINE';
      health.errors.push({ component: 'Server Ping', message: `Could not connect to server on port 5000: ${err.message}` });
      resolve();
    });

    req.setTimeout(3000, () => {
      req.destroy();
      health.serverOnline = 'TIMEOUT';
      health.errors.push({ component: 'Server Ping', message: 'Server ping timed out after 3 seconds' });
      resolve();
    });
  });
};

checkServer().then(() => {
  fs.writeFileSync(reportPath, JSON.stringify(health, null, 2));
  console.log('Health report written to:', reportPath);
  if (health.errors.length > 0) {
    console.error('Test script finished with errors. Review scripts/health-report.json.');
    process.exit(1);
  } else {
    console.log('All tests passed successfully!');
    process.exit(0);
  }
});
