#!/usr/bin/env node
'use strict';

const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const ENV_FILE = path.join(SCRIPT_DIR, '.env');

loadEnvFile(ENV_FILE);

const HOST = process.env.DEPLOY_WEBHOOK_HOST || '127.0.0.1';
const PORT = Number(process.env.DEPLOY_WEBHOOK_PORT || 9000);
const SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';
const DEPLOY_BRANCH = process.env.DEPLOY_BRANCH || 'main';
const TRIGGER_SCRIPT =
  process.env.DEPLOY_TRIGGER_SCRIPT || path.join(SCRIPT_DIR, 'trigger-deploy.sh');
const LOG_DIR = process.env.DEPLOY_LOG_DIR || '/var/log/deploy-webhook';
const WEBHOOK_PATH = '/hooks/github-deploy';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function appendWebhookLog(message) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logPath = path.join(LOG_DIR, 'webhook.log');
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
}

function verifyGitHubSignature(rawBody, signatureHeader) {
  if (!SECRET) {
    return false;
  }

  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expected = crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');
  const received = signatureHeader.slice('sha256='.length);

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function triggerDeploy(meta) {
  appendWebhookLog(`Triggering deploy: ${JSON.stringify(meta)}`);

  const child = spawn(TRIGGER_SCRIPT, [], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      DEPLOY_LOG_DIR: LOG_DIR,
    },
  });
  child.unref();
}

function handleWebhook(req, res, rawBody) {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'] || 'unknown';

  if (!verifyGitHubSignature(rawBody, signature)) {
    appendWebhookLog(`Rejected ${event}: invalid signature`);
    sendJson(res, 401, { error: 'Invalid signature' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON' });
    return;
  }

  if (event === 'ping') {
    appendWebhookLog('GitHub ping received');
    sendJson(res, 200, { ok: true, message: 'pong' });
    return;
  }

  if (event !== 'push') {
    appendWebhookLog(`Ignored ${event}`);
    sendJson(res, 200, { ok: true, ignored: true, reason: `event ${event}` });
    return;
  }

  const ref = payload.ref;
  const expectedRef = `refs/heads/${DEPLOY_BRANCH}`;
  if (ref !== expectedRef) {
    appendWebhookLog(`Ignored push to ${ref}`);
    sendJson(res, 200, { ok: true, ignored: true, reason: `ref ${ref}` });
    return;
  }

  triggerDeploy({
    ref,
    pusher: payload.pusher && payload.pusher.name,
    commit: payload.head_commit && payload.head_commit.id
      ? payload.head_commit.id.slice(0, 7)
      : null,
  });

  sendJson(res, 202, { ok: true, message: 'Deploy started' });
}

function readDeployStatus() {
  const statusFile = path.join(LOG_DIR, 'last-status.json');
  if (!fs.existsSync(statusFile)) {
    return { state: 'unknown', message: 'No deploy has run yet' };
  }

  try {
    return JSON.parse(fs.readFileSync(statusFile, 'utf8'));
  } catch {
    return { state: 'unknown', message: 'Could not read deploy status' };
  }
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'deploy-webhook' });
    return;
  }

  if (req.method === 'GET' && url.pathname === `${WEBHOOK_PATH}/status`) {
    sendJson(res, 200, readDeployStatus());
    return;
  }

  if (req.method === 'POST' && url.pathname === WEBHOOK_PATH) {
    try {
      const rawBody = await collectRequestBody(req);
      handleWebhook(req, res, rawBody);
    } catch (error) {
      appendWebhookLog(`Request error: ${error.message}`);
      sendJson(res, 500, { error: 'Internal server error' });
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, HOST, () => {
  console.log(`deploy-webhook listening on http://${HOST}:${PORT}`);
  if (!SECRET) {
    console.warn('WARNING: GITHUB_WEBHOOK_SECRET is not set — all webhook calls will be rejected');
  }
});
