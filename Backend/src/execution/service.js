
import Dockerode from 'dockerode';
import { WebSocketServer } from 'ws';

export const createExecutionService = () => {
  const docker = new Dockerode({
    socketPath: process.platform === 'win32' 
      ? '//./pipe/docker_engine' 
      : '/var/run/docker.sock'
  });

  const wss = new WebSocketServer({ port: 8080 });

  const languageConfigs = {
    javascript: {
      image: 'node:16',
      cmd: ['node', '-e'],
      timeout: 5000
    },
    python: {
      image: 'python:3.9',
      cmd: ['python', '-c'],
      timeout: 5000
    },
    html: {
      image: 'nginx',
      cmd: ['echo', 'HTML cannot be executed directly'],
      timeout: 1000
    }
  };

  const parseDockerOutput = (chunk) => {
    const output = chunk.toString();
    // Remove Docker stream headers (8 bytes) if present
    return output.length > 8 && output.charCodeAt(0) <= 2 
      ? output.slice(8) 
      : output;
  };

  const sendMessage = (ws, type, data, timestamp = true) => {
    const message = {
      type,
      data,
      ...(timestamp && { timestamp: new Date().toISOString() })
    };
    ws.send(JSON.stringify(message));
  };

  wss.on('connection', (ws) => {
    sendMessage(ws, 'system', '🔗 Connected to execution service', false);

    ws.on('message', async (message) => {
      let parsed;
      try {
        parsed = JSON.parse(message);
      } catch (err) {
        sendMessage(ws, 'error', '❌ Invalid JSON format');
        return;
      }

      const { code, language, sessionId } = parsed;
      const config = languageConfigs[language];

      if (!config) {
        sendMessage(ws, 'error', `❌ Language '${language}' not supported`);
        return;
      }

      if (!code || code.trim() === '') {
        sendMessage(ws, 'error', '❌ No code provided');
        return;
      }

      sendMessage(ws, 'system', `🚀 Executing ${language} code...`);

      let container;
      try {
        // Pull the image first
        await new Promise((resolve, reject) => {
          docker.pull(config.image, (err, stream) => {
            if (err) return reject(err);
            
            docker.modem.followProgress(stream, (err) => {
              err ? reject(err) : resolve();
            });
          });
        });

        container = await docker.createContainer({
          Image: config.image,
          Cmd: [...config.cmd, code],
          Tty: false,
          HostConfig: {
            AutoRemove: true,
            Memory: 100 * 1024 * 1024,
            MemorySwap: 200 * 1024 * 1024,
            CpuPeriod: 100000,
            CpuQuota: 50000,
            CpuShares: 512,
            BlkioWeight: 300,
            OomKillDisable: false,
            PidsLimit: 100,
            NetworkMode: 'none',
            CapDrop: ['ALL'],
            SecurityOpt: ['no-new-privileges']
          },
          Env: [
            'LANG=en_US.UTF-8',
            'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
            'NODE_ENV=production'
          ]
        });

        await container.start();

        const stream = await container.logs({
          follow: true,
          stdout: true,
          stderr: true,
          timestamps: false
        });

        let hasOutput = false;

        // Handle stream data
        stream.on('data', (chunk) => {
          hasOutput = true;
          const cleanOutput = parseDockerOutput(chunk);
          if (cleanOutput.trim()) {
            sendMessage(ws, 'output', cleanOutput, false);
          }
        });

        stream.on('end', () => {
          if (!hasOutput) {
            sendMessage(ws, 'output', '(no output)', false);
          }
          sendMessage(ws, 'end', '✅ Execution completed');
        });

        // Timeout handling
        const timeout = setTimeout(async () => {
          try {
            await container.stop();
            sendMessage(ws, 'error', '⏱️ Execution timed out');
          } catch (e) {
            console.error('Error stopping container:', e);
          }
        }, config.timeout);

        // Clean up on WS close
        ws.on('close', async () => {
          clearTimeout(timeout);
          try {
            if (container) await container.stop();
          } catch (e) {
            console.error('Error cleaning up container:', e);
          }
        });

      } catch (error) {
        console.error('Execution error:', error);
        const errorMsg = error.message.includes('pull') 
          ? '🐳 Docker image unavailable' 
          : `💥 ${error.message}`;
        
        sendMessage(ws, 'error', errorMsg);

        try {
          await docker.pruneImages({ filters: { dangling: { false: false } }});
        } catch (pruneError) {
          console.error('Image pruning failed:', pruneError);
        }
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });

  console.log('Execution service running on ws://localhost:8080');
};