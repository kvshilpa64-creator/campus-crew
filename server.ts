import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, '.data');
const AUTH_STORE_PATH = path.resolve(DATA_DIR, 'admin-auth.json');

// Session signing key from env with secure random ephemeral fallback
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const revokedTokenIds = new Set<string>();

interface StoredAdminAuth {
  email: string;
  salt: string;
  hash: string;
  updatedAt: string;
}

interface TokenPayload {
  jti: string;
  email: string;
  role: 'admin';
  exp: number;
}

interface AuthenticatedRequest extends Request {
  admin?: { email: string; jti: string };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120;
}

function hashPassword(password: string, saltHex?: string): { salt: string; hash: string } {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
}

function verifyScryptPassword(password: string, salt: string, expectedHashHex: string): boolean {
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function safeCompareStrings(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a).digest();
  const digestB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function readStoredAdmin(): StoredAdminAuth | null {
  try {
    if (!fs.existsSync(AUTH_STORE_PATH)) return null;
    const raw = fs.readFileSync(AUTH_STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as StoredAdminAuth;
    if (
      parsed &&
      typeof parsed.email === 'string' &&
      typeof parsed.salt === 'string' &&
      typeof parsed.hash === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredAdmin(record: StoredAdminAuth): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const resolved = path.resolve(AUTH_STORE_PATH);
  if (!resolved.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid auth storage path');
  }
  fs.writeFileSync(resolved, JSON.stringify(record, null, 2), 'utf-8');
}

function signToken(email: string): string {
  const payload: TokenPayload = {
    jti: crypto.randomUUID(),
    email,
    role: 'admin',
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as TokenPayload;
    if (!payload || payload.role !== 'admin' || typeof payload.email !== 'string') {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    if (revokedTokenIds.has(payload.jti)) return null;
    return payload;
  } catch {
    return null;
  }
}

function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
    return;
  }
  req.admin = { email: payload.email, jti: payload.jti };
  next();
}

function getEnvPasscode(): string {
  return (process.env.ADMIN_PASSCODE || '').trim();
}

function getEnvEmail(): string {
  return (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  // Auth Status: tells client whether first-run setup is needed
  app.get('/api/auth/status', (_req: Request, res: Response) => {
    const envPass = getEnvPasscode();
    const stored = readStoredAdmin();
    const configured = Boolean(envPass) || Boolean(stored);
    const emailHint = envPass
      ? getEnvEmail() || undefined
      : stored?.email || undefined;

    res.json({
      configured,
      mode: envPass ? 'env' : stored ? 'claimed' : 'unclaimed',
      emailHint,
    });
  });

  // First-Run Admin Setup: atomically sets initial admin email + password hash when unclaimed
  app.post('/api/auth/setup', (req: Request, res: Response) => {
    if (getEnvPasscode() || readStoredAdmin()) {
      res.status(409).json({
        error: 'Admin credentials are already configured. Please sign in with your password.',
      });
      return;
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const confirmPassword =
      typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid admin email address.' });
      return;
    }
    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    const { salt, hash } = hashPassword(password);
    writeStoredAdmin({
      email,
      salt,
      hash,
      updatedAt: new Date().toISOString(),
    });

    const token = signToken(email);
    res.status(201).json({ token, admin: { email } });
  });

  // Admin Sign In
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email) || !password) {
      res.status(400).json({ error: 'Valid email and password are required.' });
      return;
    }

    const envPass = getEnvPasscode();
    const envEmail = getEnvEmail();

    if (envPass) {
      const emailOk = envEmail ? safeCompareStrings(email, envEmail) : true;
      const passOk = safeCompareStrings(password, envPass);
      if (!emailOk || !passOk) {
        res.status(401).json({ error: 'Invalid admin email or password.' });
        return;
      }
      const token = signToken(email);
      res.json({ token, admin: { email } });
      return;
    }

    const stored = readStoredAdmin();
    if (!stored) {
      res.status(409).json({
        error: 'Admin password has not been set yet. Complete initial setup first.',
      });
      return;
    }

    const emailOk = safeCompareStrings(email, stored.email.toLowerCase());
    const passOk = verifyScryptPassword(password, stored.salt, stored.hash);
    if (!emailOk || !passOk) {
      res.status(401).json({ error: 'Invalid admin email or password.' });
      return;
    }

    const token = signToken(stored.email);
    res.json({ token, admin: { email: stored.email } });
  });

  // Verify Current Session
  app.get('/api/auth/me', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ admin: { email: req.admin!.email } });
  });

  // Change / Update Admin Password (authenticated)
  app.post(
    '/api/auth/change-password',
    requireAdminAuth,
    (req: AuthenticatedRequest, res: Response) => {
      if (getEnvPasscode()) {
        res.status(400).json({
          error:
            'Admin passcode is currently managed via environment secrets (ADMIN_PASSCODE). Update it in Secrets.',
        });
        return;
      }

      const stored = readStoredAdmin();
      if (!stored) {
        res.status(404).json({ error: 'No stored admin credential found.' });
        return;
      }

      const currentPassword =
        typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      const confirmPassword =
        typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

      if (!verifyScryptPassword(currentPassword, stored.salt, stored.hash)) {
        res.status(401).json({ error: 'Current password is incorrect.' });
        return;
      }

      if (newPassword.length < 8 || newPassword.length > 128) {
        res.status(400).json({ error: 'New password must be between 8 and 128 characters.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        res.status(400).json({ error: 'New passwords do not match.' });
        return;
      }

      const { salt, hash } = hashPassword(newPassword);
      writeStoredAdmin({
        email: stored.email,
        salt,
        hash,
        updatedAt: new Date().toISOString(),
      });

      // Revoke previous token and issue a fresh one
      revokedTokenIds.add(req.admin!.jti);
      const token = signToken(stored.email);
      res.json({ success: true, token, admin: { email: stored.email } });
    }
  );

  // Sign Out (revokes active token)
  app.post('/api/auth/logout', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    revokedTokenIds.add(req.admin!.jti);
    res.json({ success: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OMNIS-X server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start OMNIS-X server:', err);
  process.exit(1);
});
