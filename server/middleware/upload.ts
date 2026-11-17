import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { env } from '../config/env';

fs.mkdirSync(env.uploadDir, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(env.uploadDir, { recursive: true });
    cb(null, env.uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

export const evidenceUpload = multer({
  storage,
  limits: {
    fileSize: env.maxUploadSizeBytes,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error('Unsupported file type. Only JPG, JPEG, PNG, and PDF files are allowed.'));
      return;
    }
    cb(null, true);
  },
});
