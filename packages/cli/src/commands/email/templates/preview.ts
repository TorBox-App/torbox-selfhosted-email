import { existsSync, watch } from "node:fs";
import type { ServerResponse } from "node:http";
import { join } from "node:path";
import * as clack from "@clack/prompts";
import type { Express } from "express";
import pc from "picocolors";
import { trackCommand } from "../../../telemetry/events.js";
import {
  compileForPreview,
  discoverTemplates,
  loadWrapsConfig,
  type PreviewResult,
} from "../../../utils/email/template-compiler.js";
import { errors } from "../../../utils/shared/errors.js";

type TemplatesPreviewOptions = {
  port?: number;
  template?: string;
  noOpen?: boolean;
};

export async function templatesPreview(options: TemplatesPreviewOptions) {
  const cwd = process.cwd();
  const wrapsDir = join(cwd, "wraps");
  const configPath = join(wrapsDir, "wraps.config.ts");

  if (!existsSync(configPath)) {
    throw errors.wrapsConfigNotFound();
  }

  clack.intro(pc.bold("Preview Templates"));

  // Load config
  const config = await loadWrapsConfig(wrapsDir);
  const templatesDir = join(wrapsDir, config.templatesDir || "./templates");

  if (!existsSync(templatesDir)) {
    throw errors.wrapsConfigNotFound();
  }

  // Discover templates
  const templateFiles = await discoverTemplates(templatesDir, options.template);

  if (templateFiles.length === 0) {
    clack.log.info("No templates found.");
    return;
  }

  // Compilation cache
  const cache = new Map<string, PreviewResult>();

  async function getCompiled(slug: string): Promise<PreviewResult> {
    const cached = cache.get(slug);
    if (cached) {
      return cached;
    }

    const file = templateFiles.find((f) => f.replace(/\.tsx?$/, "") === slug);
    if (!file) {
      throw new Error(`Template not found: ${slug}`);
    }

    const result = await compileForPreview(
      join(templatesDir, file),
      slug,
      wrapsDir
    );
    cache.set(slug, result);
    return result;
  }

  // SSE clients
  const sseClients = new Set<ServerResponse>();

  function broadcastSSE(slug: string) {
    for (const res of sseClients) {
      res.write(`data: ${JSON.stringify({ slug })}\n\n`);
    }
  }

  // File watcher with debounce
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  watch(templatesDir, { recursive: true }, (_event, filename) => {
    if (!filename) {
      return;
    }
    // Ignore non-template files
    if (!(filename.endsWith(".tsx") || filename.endsWith(".ts"))) {
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      const slug = filename.replace(/\.tsx?$/, "");
      cache.delete(slug);
      // Also clear cache for all templates since shared components may have changed
      if (filename.startsWith("_")) {
        cache.clear();
      }
      broadcastSSE(slug);
    }, 100);
  });

  // Start Express server
  const express = (await import("express")).default;
  const getPort = (await import("get-port")).default;

  const app: Express = express();

  // SSE endpoint
  app.get("/_events", (_req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("data: connected\n\n");
    sseClients.add(res);
    _req.on("close", () => sseClients.delete(res));
  });

  // Template list
  app.get("/", async (_req, res) => {
    try {
      const slugs = templateFiles.map((f) => f.replace(/\.tsx?$/, ""));
      // Pre-compile all to get metadata
      const meta: Array<{
        slug: string;
        subject: string;
        emailType: string;
        previewText?: string;
      }> = [];

      for (const slug of slugs) {
        try {
          const compiled = await getCompiled(slug);
          meta.push({
            slug: compiled.slug,
            subject: compiled.subject,
            emailType: compiled.emailType,
            previewText: compiled.previewText,
          });
        } catch {
          // guardrail:allow-swallowed-error — compilation error shows placeholder
          meta.push({
            slug,
            subject: "(compilation error)",
            emailType: "unknown",
          });
        }
      }

      res.send(renderListPage(meta));
    } catch (err) {
      res.status(500).send(renderErrorPage(err));
    }
  });

  // Rendered HTML (iframe src)
  app.get("/:slug/render", async (req, res) => {
    try {
      const compiled = await getCompiled(req.params.slug);
      res.type("html").send(compiled.html);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res
        .status(500)
        .type("html")
        .send(
          `<pre style="color:red;padding:20px;font-family:monospace">${escapeHtml(msg)}</pre>`
        );
    }
  });

  // Viewer page
  app.get("/:slug", async (req, res) => {
    try {
      const compiled = await getCompiled(req.params.slug);
      const slugs = templateFiles.map((f) => f.replace(/\.tsx?$/, ""));
      res.send(renderViewerPage(compiled, slugs));
    } catch (err) {
      res.status(500).send(renderErrorPage(err));
    }
  });

  const port =
    options.port || (await getPort({ port: [3333, 3334, 3335, 3336, 3337] }));

  const server = app.listen(port, () => {
    const url = `http://localhost:${port}`;

    trackCommand("email:templates:preview", {
      success: true,
      template_count: templateFiles.length,
    });

    clack.log.success(`Preview server running at ${pc.cyan(url)}`);

    if (options.template) {
      clack.log.info(`Previewing: ${pc.cyan(options.template)}`);
    } else {
      clack.log.info(
        `${templateFiles.length} template${templateFiles.length === 1 ? "" : "s"} available`
      );
    }

    console.log(`${pc.dim("Press Ctrl+C to stop")}\n`);

    // Open browser
    if (!options.noOpen) {
      const openUrl =
        options.template && templateFiles.length === 1
          ? `${url}/${templateFiles[0].replace(/\.tsx?$/, "")}`
          : url;
      import("open").then((mod) => mod.default(openUrl));
    }
  });

  // Graceful shutdown
  const shutdown = () => {
    for (const res of sseClients) {
      res.end();
    }
    sseClients.clear();
    server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep process alive
  await new Promise(() => {});
}

// ── HTML Rendering ──

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderListPage(
  templates: Array<{
    slug: string;
    subject: string;
    emailType: string;
    previewText?: string;
  }>
): string {
  const rows = templates
    .map(
      (t) => `
      <a href="/${t.slug}" class="template">
        <div class="template-header">
          <span class="template-name">${escapeHtml(t.slug)}</span>
          <span class="badge badge-${t.emailType}">${escapeHtml(t.emailType)}</span>
        </div>
        <div class="template-subject">${escapeHtml(t.subject)}</div>
        ${t.previewText ? `<div class="template-preview">${escapeHtml(t.previewText)}</div>` : ""}
      </a>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Wraps — Template Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0c0a09; color: #e7e5e4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .container { max-width: 720px; margin: 0 auto; padding: 48px 24px; }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
    .subtitle { color: #78716c; font-size: 14px; margin-bottom: 32px; }
    .template { display: block; background: #1c1917; border: 1px solid #292524; border-radius: 8px; padding: 16px 20px; margin-bottom: 12px; text-decoration: none; color: inherit; transition: border-color 0.15s; }
    .template:hover { border-color: #f59e0b; }
    .template-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .template-name { font-size: 15px; font-weight: 600; color: #fafaf9; }
    .badge { font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.04em; }
    .badge-transactional { background: #1e3a5f; color: #60a5fa; }
    .badge-marketing { background: #3b1f4b; color: #c084fc; }
    .badge-unknown { background: #292524; color: #78716c; }
    .template-subject { font-size: 13px; color: #a8a29e; }
    .template-preview { font-size: 12px; color: #57534e; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Email Templates</h1>
    <p class="subtitle">${templates.length} template${templates.length === 1 ? "" : "s"} &bull; Live reload enabled</p>
    ${rows}
  </div>
  <script>
    const es = new EventSource('/_events');
    es.onmessage = (e) => {
      if (e.data === 'connected') return;
      location.reload();
    };
  </script>
</body>
</html>`;
}

function renderViewerPage(compiled: PreviewResult, allSlugs: string[]): string {
  const navOptions = allSlugs
    .map(
      (s) =>
        `<option value="${escapeHtml(s)}" ${s === compiled.slug ? "selected" : ""}>${escapeHtml(s)}</option>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(compiled.slug)} — Wraps Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0c0a09; color: #e7e5e4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; flex-direction: column; height: 100vh; }
    .toolbar { background: #1c1917; border-bottom: 1px solid #292524; padding: 12px 20px; display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
    .toolbar-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
    .back-link { color: #78716c; text-decoration: none; font-size: 14px; flex-shrink: 0; }
    .back-link:hover { color: #f59e0b; }
    .nav-select { background: #292524; color: #fafaf9; border: 1px solid #44403c; border-radius: 6px; padding: 6px 12px; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; max-width: 240px; }
    .nav-select:hover { border-color: #f59e0b; }
    .badge { font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0; }
    .badge-transactional { background: #1e3a5f; color: #60a5fa; }
    .badge-marketing { background: #3b1f4b; color: #c084fc; }
    .meta { font-size: 13px; color: #78716c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .toolbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .size-btn { background: #292524; color: #a8a29e; border: 1px solid #44403c; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-family: inherit; cursor: pointer; }
    .size-btn:hover { border-color: #f59e0b; color: #fafaf9; }
    .size-btn.active { border-color: #f59e0b; color: #f59e0b; }
    .iframe-wrap { flex: 1; display: flex; justify-content: center; background: #171412; overflow: auto; padding: 24px; }
    iframe { background: #fff; border: none; border-radius: 4px; transition: width 0.2s; height: 100%; min-height: 0; }
    .subject-bar { background: #1c1917; border-bottom: 1px solid #292524; padding: 8px 20px; font-size: 13px; display: flex; gap: 12px; flex-shrink: 0; }
    .subject-label { color: #57534e; }
    .subject-value { color: #a8a29e; }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <a href="/" class="back-link">&larr;</a>
      <select class="nav-select" onchange="location.href='/'+this.value">
        ${navOptions}
      </select>
      <span class="badge badge-${compiled.emailType}">${escapeHtml(compiled.emailType)}</span>
      ${compiled.previewText ? `<span class="meta" title="${escapeHtml(compiled.previewText)}">${escapeHtml(compiled.previewText)}</span>` : ""}
    </div>
    <div class="toolbar-right">
      <button class="size-btn active" data-width="100%" onclick="setWidth(this,'100%')">Desktop</button>
      <button class="size-btn" data-width="375px" onclick="setWidth(this,'375px')">Mobile</button>
    </div>
  </div>
  <div class="subject-bar">
    <span class="subject-label">Subject:</span>
    <span class="subject-value">${escapeHtml(compiled.subject)}</span>
  </div>
  <div class="iframe-wrap">
    <iframe id="preview" src="/${compiled.slug}/render" style="width:100%"></iframe>
  </div>
  <script>
    function setWidth(btn, w) {
      document.getElementById('preview').style.width = w;
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }

    // Auto-resize iframe to content height
    const iframe = document.getElementById('preview');
    function resizeIframe() {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        iframe.style.height = doc.documentElement.scrollHeight + 'px';
      } catch {} // guardrail:allow-swallowed-error — cross-origin iframe resize
    }
    iframe.addEventListener('load', resizeIframe);

    // SSE live reload
    const es = new EventSource('/_events');
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        // Reload iframe (and toolbar metadata by reloading the page)
        iframe.src = '/${compiled.slug}/render?t=' + Date.now();
      } catch { // guardrail:allow-swallowed-error — SSE parse error is expected
        // "connected" message or parse error — ignore
      }
    };
  </script>
</body>
</html>`;
}

function renderErrorPage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Error — Wraps Preview</title>
  <style>
    body { background: #0c0a09; color: #fca5a5; font-family: monospace; padding: 40px; }
    pre { white-space: pre-wrap; word-break: break-word; }
    a { color: #f59e0b; }
  </style>
</head>
<body>
  <h2>Compilation Error</h2>
  <pre>${escapeHtml(msg)}</pre>
  <p style="margin-top:24px"><a href="/">&larr; Back to templates</a></p>
  <script>
    const es = new EventSource('/_events');
    es.onmessage = (e) => {
      if (e.data === 'connected') return;
      location.reload();
    };
  </script>
</body>
</html>`;
}
