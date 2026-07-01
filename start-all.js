import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendDir = path.join(__dirname, 'backend');
const frontendDir = path.join(__dirname, 'frontend');

console.log('\x1b[35m%s\x1b[0m', '==================================================');
console.log('\x1b[35m%s\x1b[0m', '     STARTING SOCIAL VIDEO DOWNLOADER SERVERS     ');
console.log('\x1b[35m%s\x1b[0m', '==================================================');
console.log('Press Ctrl+C to stop both servers at once.\n');

// Spawn backend dev server
const backendProcess = spawn('npm', ['run', 'dev'], { 
  cwd: backendDir, 
  shell: true 
});

// Spawn frontend dev server
const frontendProcess = spawn('npm', ['run', 'dev'], { 
  cwd: frontendDir, 
  shell: true 
});

function pipeOutput(processInstance, prefix, colorCode) {
  processInstance.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      const cleanLine = line.trim();
      if (cleanLine) {
        console.log(`${colorCode}${prefix}\x1b[0m | ${cleanLine}`);
      }
    });
  });

  processInstance.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      const cleanLine = line.trim();
      if (cleanLine) {
        console.error(`${colorCode}${prefix} (Error)\x1b[0m | ${cleanLine}`);
      }
    });
  });
}

// Colors: Cyan for backend, Green for frontend
pipeOutput(backendProcess, '[Backend]', '\x1b[36m');
pipeOutput(frontendProcess, '[Frontend]', '\x1b[32m');

// Handle exit of either process to ensure clean shutdown of both
backendProcess.on('close', (code) => {
  console.log(`\n\x1b[31m[Backend] process exited with code ${code}\x1b[0m`);
  try {
    frontendProcess.kill();
  } catch (e) {}
  process.exit(code || 0);
});

frontendProcess.on('close', (code) => {
  console.log(`\n\x1b[31m[Frontend] process exited with code ${code}\x1b[0m`);
  try {
    backendProcess.kill();
  } catch (e) {}
  process.exit(code || 0);
});

// Windows clean shutdown hook
const cleanShutdown = () => {
  console.log('\nStopping servers...');
  
  // Try clean termination
  try { backendProcess.kill(); } catch (e) {}
  try { frontendProcess.kill(); } catch (e) {}
  
  // Wait brief moment and exit
  setTimeout(() => {
    process.exit(0);
  }, 500);
};

process.on('SIGINT', cleanShutdown);
process.on('SIGTERM', cleanShutdown);
