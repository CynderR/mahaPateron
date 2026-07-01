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
const LOG_TOKEN = process.env.DEPLOY_LOG_TOKEN || '';
const WEBHOOK_PATH = '/hooks/github-deploy';
const DEPLOY_LOG_PATTERN = /^deploy-\d{8}_\d{6}\.log$/;

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

function resolveLogPath(candidatePath) {
  if (!candidatePath) {
    return null;
  }

  const resolved = path.resolve(candidatePath);
  const logRoot = path.resolve(LOG_DIR);
  if (resolved !== logRoot && !resolved.startsWith(`${logRoot}${path.sep}`)) {
    return null;
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return null;
  }

  return resolved;
}

function readLogContent(logPath, options = {}) {
  const resolved = resolveLogPath(logPath);
  if (!resolved) {
    return null;
  }

  let content = fs.readFileSync(resolved, 'utf8');
  const tail = Number(options.tail);
  if (Number.isFinite(tail) && tail > 0) {
    content = content.split('\n').slice(-tail).join('\n');
  }

  return content;
}

function listDeployLogs(limit = 20) {
  if (!fs.existsSync(LOG_DIR)) {
    return [];
  }

  return fs
    .readdirSync(LOG_DIR)
    .filter((name) => DEPLOY_LOG_PATTERN.test(name))
    .map((name) => {
      const filePath = path.join(LOG_DIR, name);
      const stats = fs.statSync(filePath);
      return {
        name,
        at: stats.mtime.toISOString(),
        bytes: stats.size,
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

function extractLogToken(req, url) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }

  return url.searchParams.get('token') || '';
}

function isLogAccessAllowed(req, url, status) {
  // After a failure (or while running), logs are readable without a token.
  if (status.state === 'failed' || status.state === 'running') {
    return true;
  }

  if (LOG_TOKEN) {
    const provided = extractLogToken(req, url);
    if (!provided || provided.length !== LOG_TOKEN.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(LOG_TOKEN));
  }

  return false;
}

function withToken(href, req, url) {
  const token = extractLogToken(req, url);
  if (!token) {
    return href;
  }
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}token=${encodeURIComponent(token)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sendText(res, statusCode, content, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(content);
}

function sendHtml(res, statusCode, html) {
  sendText(res, statusCode, html, 'text/html; charset=utf-8');
}

function wantsHtml(req) {
  const accept = req.headers.accept || '';
  return accept.includes('text/html');
}

function renderLogPage(title, status, content, links = []) {
  const linkHtml = links
    .map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`)
    .join(' &middot; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin: 1.5rem; background: #111; color: #eee; }
    h1 { font-size: 1.1rem; font-family: system-ui, sans-serif; }
    .meta { font-family: system-ui, sans-serif; color: #bbb; margin-bottom: 1rem; }
    .links { font-family: system-ui, sans-serif; margin-bottom: 1rem; }
    pre { white-space: pre-wrap; word-break: break-word; background: #1b1b1b; padding: 1rem; border-radius: 6px; overflow: auto; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">state=${escapeHtml(status.state)} &middot; ${escapeHtml(status.message || '')} &middot; ${escapeHtml(status.at || '')}</div>
  ${linkHtml ? `<div class="links">${linkHtml}</div>` : ''}
  <pre>${escapeHtml(content || '(empty log)')}</pre>
</body>
</html>`;
}

function handleLogRequest(req, res, url, logPath, title) {
  const status = readDeployStatus();
  if (!isLogAccessAllowed(req, url, status)) {
    sendJson(res, 403, {
      error: 'Log access denied',
      hint: LOG_TOKEN
        ? 'Provide ?token=... or Authorization: Bearer ...'
        : 'Logs are only available while a deploy is running or after a failure',
    });
    return;
  }

  const content = readLogContent(logPath, { tail: url.searchParams.get('tail') });
  if (content === null) {
    sendJson(res, 404, { error: 'Log not found' });
    return;
  }

  if (wantsHtml(req)) {
    const links = [];
    const buildLog = path.join(LOG_DIR, 'last-build.log');
    if (logPath !== buildLog && fs.existsSync(buildLog)) {
      links.push({
        href: withToken(`${WEBHOOK_PATH}/logs/build`, req, url),
        label: 'Build log only',
      });
    }
    if (status.log && logPath !== status.log) {
      links.push({
        href: withToken(`${WEBHOOK_PATH}/logs/latest`, req, url),
        label: 'Full deploy log',
      });
    }
    links.push({ href: `${WEBHOOK_PATH}/status`, label: 'Status JSON' });
    sendHtml(res, 200, renderLogPage(title, status, content, links));
    return;
  }

  sendText(res, 200, content);
}

function handleFailedPage(req, res, url) {
  const status = readDeployStatus();
  if (status.state !== 'failed') {
    sendJson(res, 404, { error: 'No failed deploy to show', state: status.state });
    return;
  }

  // Public after a failure — no token required so you can open this in a browser.
  const buildLog = path.join(LOG_DIR, 'last-build.log');
  const logPath = fs.existsSync(buildLog) ? buildLog : status.log;
  const content = readLogContent(logPath, { tail: url.searchParams.get('tail') }) || '';
  const title = fs.existsSync(buildLog) ? 'Build failed' : 'Deploy failed';

  if (!wantsHtml(req)) {
    sendText(res, 200, content);
    return;
  }

  sendHtml(
    res,
    200,
    renderLogPage(title, status, content, [
      { href: withToken(`${WEBHOOK_PATH}/logs/build`, req, url), label: 'Build log' },
      { href: withToken(`${WEBHOOK_PATH}/logs/latest`, req, url), label: 'Full deploy log' },
      { href: `${WEBHOOK_PATH}/status`, label: 'Status JSON' },
    ])
  );
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

  if (req.method === 'GET' && url.pathname === `${WEBHOOK_PATH}/failed`) {
    handleFailedPage(req, res, url);
    return;
  }

  if (req.method === 'GET' && url.pathname === `${WEBHOOK_PATH}/logs`) {
    const status = readDeployStatus();
    if (!isLogAccessAllowed(req, url, status)) {
      sendJson(res, 403, {
        error: 'Log access denied',
        hint: LOG_TOKEN
          ? 'Provide ?token=... or Authorization: Bearer ...'
          : 'Logs are only available while a deploy is running or after a failure',
      });
      return;
    }

    sendJson(res, 200, {
      logs: listDeployLogs(),
      latest: status.log ? path.basename(status.log) : null,
      buildLog: fs.existsSync(path.join(LOG_DIR, 'last-build.log')) ? 'last-build.log' : null,
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === `${WEBHOOK_PATH}/logs/latest`) {
    const status = readDeployStatus();
    handleLogRequest(req, res, url, status.log, 'Latest deploy log');
    return;
  }

  if (req.method === 'GET' && url.pathname === `${WEBHOOK_PATH}/logs/build`) {
    handleLogRequest(req, res, url, path.join(LOG_DIR, 'last-build.log'), 'Build log');
    return;
  }

  const logNameMatch = url.pathname.match(new RegExp(`^${WEBHOOK_PATH}/logs/([^/]+)$`));
  if (req.method === 'GET' && logNameMatch) {
    const logName = logNameMatch[1];
    if (!DEPLOY_LOG_PATTERN.test(logName)) {
      sendJson(res, 404, { error: 'Unknown log file' });
      return;
    }

    handleLogRequest(req, res, url, path.join(LOG_DIR, logName), logName);
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
  if (!LOG_TOKEN) {
    console.warn(
      'WARNING: DEPLOY_LOG_TOKEN is not set — log endpoints are only available after a failed/running deploy'
    );
  }
});
