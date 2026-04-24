import type { Request, Response, NextFunction } from "express";
import sanitizeHtml from "sanitize-html";
import { logger } from "../logger.js";

const STRIP_ALL_HTML: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

// Free-text user content fields where HTML should be stripped to prevent stored XSS
const HTML_CONTENT_FIELDS = new Set([
  "bio",
  "message",
  "description",
  "displayName",
  "title",
  "name",
  "text",
  "content",
  "notes",
]);

// URL fields that should be normalized
const URL_FIELDS = new Set([
  "websiteUrl",
  "avatarUrl",
  "webhookUrl",
  "url",
  "link",
]);

function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function sanitizeString(
  key: string,
  value: string,
): { result: string; changed: boolean } {
  const original = value;
  let result = value.trim();

  if (HTML_CONTENT_FIELDS.has(key)) {
    const stripped = sanitizeHtml(result, STRIP_ALL_HTML);
    if (stripped !== result) result = stripped;
  }

  if (URL_FIELDS.has(key) && result.length > 0) {
    const normalized = normalizeUrl(result);
    if (normalized !== null && normalized !== result) result = normalized;
  }

  return { result, changed: result !== original };
}

export function sanitizeObject(
  obj: unknown,
  depth = 0,
): { result: unknown; changed: boolean } {
  if (depth > 10 || obj === null || obj === undefined) {
    return { result: obj, changed: false };
  }

  if (Array.isArray(obj)) {
    let changed = false;
    const result = obj.map((item) => {
      const { result: r, changed: c } = sanitizeObject(item, depth + 1);
      if (c) changed = true;
      return r;
    });
    return { result, changed };
  }

  if (typeof obj === "object") {
    let changed = false;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof value === "string") {
        const { result: r, changed: c } = sanitizeString(key, value);
        if (c) changed = true;
        result[key] = r;
      } else {
        const { result: r, changed: c } = sanitizeObject(value, depth + 1);
        if (c) changed = true;
        result[key] = r;
      }
    }
    return { result, changed };
  }

  return { result: obj, changed: false };
}

export function sanitizeBody(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (req.body && typeof req.body === "object") {
    const { result, changed } = sanitizeObject(
      req.body as Record<string, unknown>,
    );
    if (changed) {
      logger.debug(
        { method: req.method, path: req.path },
        "sanitized request body",
      );
      req.body = result;
    }
  }
  next();
}

export function sanitizeQuery(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.query || typeof req.query !== "object") return next();

  let changed = false;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      sanitized[key] = trimmed;
      if (trimmed !== value) changed = true;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((v) => (typeof v === "string" ? v.trim() : v));
    } else {
      sanitized[key] = value;
    }
  }

  if (changed) {
    logger.debug(
      { method: req.method, path: req.path },
      "sanitized query params",
    );
    req.query = sanitized as typeof req.query;
  }
  next();
}
