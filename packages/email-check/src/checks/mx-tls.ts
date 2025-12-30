/**
 * MX TLS Check
 * Connects to mail servers and checks STARTTLS support and certificate validity
 */

import * as net from "node:net";
import * as tls from "node:tls";
import type { MxRecord, MxTlsResult, MxTlsServerResult } from "../types.js";

const DEFAULT_TIMEOUT = 10_000; // 10 seconds per server
const SMTP_PORT = 25;

export interface MxTlsCheckOptions {
  /** Skip TLS checks entirely */
  skip?: boolean;
  /** Connection timeout in ms */
  timeout?: number;
  /** Quick mode - only check first MX */
  quick?: boolean;
}

/**
 * Check TLS support for MX servers
 */
export async function checkMxTls(
  mxRecords: MxRecord[],
  options: MxTlsCheckOptions = {}
): Promise<MxTlsResult> {
  const { skip = false, timeout = DEFAULT_TIMEOUT, quick = false } = options;

  const result: MxTlsResult = {
    checked: false,
    skipped: skip,
    skipReason: skip ? "--skip-tls flag" : null,
    servers: [],
  };

  if (skip) {
    return result;
  }

  if (mxRecords.length === 0) {
    result.skipReason = "No MX records";
    result.skipped = true;
    return result;
  }

  // Sort by priority (lowest first) and limit in quick mode
  const sortedMx = [...mxRecords].sort((a, b) => a.priority - b.priority);
  const mxToCheck = quick ? sortedMx.slice(0, 1) : sortedMx.slice(0, 5); // Max 5 servers

  // Check servers in parallel with concurrency limit
  const checkPromises = mxToCheck.map((mx) =>
    checkServer(mx.exchange, timeout)
  );

  try {
    result.servers = await Promise.all(checkPromises);
    result.checked = true;
  } catch (error: any) {
    result.skipReason = error.message || "TLS check failed";
  }

  return result;
}

/**
 * Check TLS support for a single mail server
 */
async function checkServer(
  hostname: string,
  timeout: number
): Promise<MxTlsServerResult> {
  const result: MxTlsServerResult = {
    server: hostname,
    port: SMTP_PORT,
    connected: false,
    connectionError: null,
    supportsStarttls: false,
    tlsVersions: [],
    preferredTlsVersion: null,
    cipherSuite: null,
    certificate: null,
    errors: [],
  };

  try {
    // Step 1: Connect and get SMTP banner
    const smtpSession = await connectSmtp(hostname, SMTP_PORT, timeout);
    result.connected = true;

    // Step 2: Send EHLO and check capabilities
    const capabilities = await sendEhlo(smtpSession, timeout);
    result.supportsStarttls = capabilities.includes("STARTTLS");

    if (!result.supportsStarttls) {
      smtpSession.socket.destroy();
      result.errors.push("Server does not advertise STARTTLS");
      return result;
    }

    // Step 3: Initiate STARTTLS
    const tlsResult = await upgradeToTls(smtpSession, hostname, timeout);

    if (tlsResult.success && tlsResult.socket) {
      result.preferredTlsVersion = tlsResult.tlsVersion || null;
      result.cipherSuite = tlsResult.cipher || null;

      if (tlsResult.tlsVersion) {
        result.tlsVersions.push(tlsResult.tlsVersion);
      }

      // Step 4: Get certificate info
      if (tlsResult.certificate) {
        const cert = tlsResult.certificate;
        const now = new Date();
        const expiresAt = new Date(cert.valid_to);
        const daysUntilExpiry = Math.floor(
          (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        result.certificate = {
          valid: tlsResult.authorized,
          issuer: formatX509Name(cert.issuer),
          subject: formatX509Name(cert.subject),
          altNames: parseAltNames(cert.subjectaltname),
          expiresAt: cert.valid_to,
          daysUntilExpiry,
          matchesHostname: tlsResult.authorized,
          selfSigned: isSelfSigned(cert),
          chainValid: tlsResult.authorized,
        };
      }

      tlsResult.socket.destroy();
    } else {
      result.errors.push(tlsResult.error || "TLS upgrade failed");
    }
  } catch (error: any) {
    result.connectionError = error.message || "Connection failed";
    if (error.code === "ECONNREFUSED") {
      result.connectionError = "Connection refused (port 25 blocked?)";
    } else if (
      error.code === "ETIMEDOUT" ||
      error.message?.includes("timeout")
    ) {
      result.connectionError = "Connection timed out";
    } else if (error.code === "ENOTFOUND") {
      result.connectionError = "Host not found";
    }
  }

  return result;
}

interface SmtpSession {
  socket: net.Socket;
  buffer: string;
}

/**
 * Connect to SMTP server and wait for banner
 */
function connectSmtp(
  hostname: string,
  port: number,
  timeout: number
): Promise<SmtpSession> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: hostname, port });
    let buffer = "";
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        reject(new Error("Connection timeout"));
      }
    }, timeout);

    socket.on("connect", () => {
      // Wait for banner
    });

    socket.on("data", (data) => {
      buffer += data.toString();
      // SMTP banner ends with 220 ... \r\n
      if (buffer.includes("\r\n") && buffer.startsWith("220") && !resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ socket, buffer: "" });
      }
    });

    socket.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    socket.on("close", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(new Error("Connection closed"));
      }
    });
  });
}

/**
 * Send EHLO and parse capabilities
 */
function sendEhlo(session: SmtpSession, timeout: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("EHLO timeout"));
      }
    }, timeout);

    session.socket.on("data", (data) => {
      buffer += data.toString();
      // Multi-line response ends with 250 (space) or single line 250
      const lines = buffer.split("\r\n").filter(Boolean);
      const lastLine = lines[lines.length - 1];

      if (lastLine && /^250[ ]/.test(lastLine) && !resolved) {
        resolved = true;
        clearTimeout(timer);

        // Parse capabilities from 250-XXX lines
        const capabilities = lines
          .filter((line) => line.startsWith("250"))
          .map((line) => line.slice(4).trim().toUpperCase());

        resolve(capabilities);
      }
    });

    session.socket.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    // Send EHLO
    session.socket.write("EHLO mail.check.wraps.dev\r\n");
  });
}

interface TlsUpgradeResult {
  success: boolean;
  socket?: tls.TLSSocket;
  tlsVersion?: string;
  cipher?: string;
  certificate?: tls.PeerCertificate;
  authorized?: boolean;
  error?: string;
}

/**
 * Upgrade connection to TLS via STARTTLS
 */
function upgradeToTls(
  session: SmtpSession,
  hostname: string,
  timeout: number
): Promise<TlsUpgradeResult> {
  return new Promise((resolve) => {
    let buffer = "";
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: "STARTTLS timeout" });
      }
    }, timeout);

    const onData = (data: Buffer) => {
      buffer += data.toString();

      if (buffer.includes("220")) {
        // Server ready for TLS
        session.socket.removeListener("data", onData);

        // Upgrade to TLS
        const tlsSocket = tls.connect(
          {
            socket: session.socket,
            servername: hostname,
            rejectUnauthorized: false, // We'll check manually
            minVersion: "TLSv1.2",
          },
          () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);

              const cipher = tlsSocket.getCipher();
              const cert = tlsSocket.getPeerCertificate();

              resolve({
                success: true,
                socket: tlsSocket,
                tlsVersion: tlsSocket.getProtocol() || undefined,
                cipher: cipher?.name,
                certificate: cert,
                authorized: tlsSocket.authorized,
              });
            }
          }
        );

        tlsSocket.on("error", (err) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            resolve({ success: false, error: err.message });
          }
        });
      } else if (buffer.includes("454") || buffer.includes("501")) {
        // TLS not available
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({ success: false, error: "Server rejected STARTTLS" });
        }
      }
    };

    session.socket.on("data", onData);
    session.socket.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ success: false, error: err.message });
      }
    });

    // Send STARTTLS command
    session.socket.write("STARTTLS\r\n");
  });
}

/**
 * Format X.509 name object to string
 */
function formatX509Name(name: tls.PeerCertificate["issuer"]): string {
  if (!name) return "";
  const parts: string[] = [];
  if (name.O) parts.push(name.O);
  if (name.CN) parts.push(name.CN);
  return parts.join(" - ") || JSON.stringify(name);
}

/**
 * Parse Subject Alternative Names
 */
function parseAltNames(subjectaltname?: string): string[] {
  if (!subjectaltname) return [];
  return subjectaltname
    .split(", ")
    .filter((san) => san.startsWith("DNS:"))
    .map((san) => san.slice(4));
}

/**
 * Check if certificate is self-signed
 */
function isSelfSigned(cert: tls.PeerCertificate): boolean {
  if (!(cert.issuer && cert.subject)) return false;
  return cert.issuer.CN === cert.subject.CN && cert.issuer.O === cert.subject.O;
}

/**
 * Format MX TLS results for display
 */
export function formatMxTlsResult(result: MxTlsResult): string {
  if (result.skipped) {
    return `Skipped (${result.skipReason})`;
  }

  if (!result.checked) {
    return "Not checked";
  }

  const allSupportTls = result.servers.every((s) => s.supportsStarttls);
  const allValidCerts = result.servers.every(
    (s) => s.certificate?.valid === true
  );

  if (allSupportTls && allValidCerts) {
    const versions = [
      ...new Set(
        result.servers.map((s) => s.preferredTlsVersion).filter(Boolean)
      ),
    ];
    return `All ${result.servers.length} servers support TLS (${versions.join(", ")})`;
  }

  if (allSupportTls) {
    return "All servers support TLS, some certificate issues";
  }

  const noTls = result.servers.filter((s) => !s.supportsStarttls);
  return `${noTls.length}/${result.servers.length} servers missing TLS support`;
}
