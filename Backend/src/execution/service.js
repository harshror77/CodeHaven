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

  wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
      let parsed;
      try {
        parsed = JSON.parse(message);
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', data: 'Invalid JSON' }));
        return;
      }

      const { code, language, sessionId } = parsed;
      const config = languageConfigs[language];

      if (!config) {
        ws.send(JSON.stringify({ type: 'error', data: 'Unsupported language' }));
        return;
      }

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

        // Handle stream data
        stream.on('data', (chunk) => {
          ws.send(JSON.stringify({
            type: 'output',
            data: chunk.toString()
          }));
        });

        stream.on('end', () => {
          ws.send(JSON.stringify({
            type: 'end',
            data: 'Execution completed'
          }));
        });

        // Timeout handling
        const timeout = setTimeout(async () => {
          try {
            await container.stop();
            ws.send(JSON.stringify({
              type: 'error',
              data: 'Execution timed out'
            }));
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
        ws.send(JSON.stringify({ 
          type: 'error',
          data: error.message
        }));

        try {
          await docker.pruneImages({ filters: { dangling: { false: false } }});
        } catch (pruneError) {
          console.error('Image pruning failed:', pruneError);
        }
      }
    });
  });

  console.log('Execution service running on ws://localhost:8080');
};