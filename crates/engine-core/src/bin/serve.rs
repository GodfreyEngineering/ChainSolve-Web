//! `engine-serve` — lightweight HTTP server for hybrid compute (7.12).
//!
//! Exposes the engine-core evaluation API over HTTP so that the
//! `heavy-compute` Supabase Edge Function can delegate large graph
//! evaluations to a native binary for maximum throughput.
//!
//! ## Endpoints
//!
//! - `POST /evaluate`
//!   Body:  `EngineSnapshotV1` as JSON
//!   Reply: `EvalResult` as JSON   (200 OK)
//!          `{ "error": "..." }`    (400/500)
//!
//! - `GET /health`
//!   Reply: `{ "status": "ok", "version": "..." }`
//!
//! ## Usage
//!
//! ```bash
//! cargo build -p engine-core --bin serve --release
//! ./target/release/serve --port 3099
//! ```
//!
//! Environment variables:
//!   PORT            — listening port (default: 3099, overridden by --port)
//!   LOG_LEVEL       — "debug" | "info" | "warn" | "error" (default: "info")

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::thread;

// ── HTTP helpers ──────────────────────────────────────────────────────────────

fn read_http_request(stream: &mut TcpStream) -> Option<(String, String, usize, Vec<u8>)> {
    let mut reader = BufReader::new(stream.try_clone().ok()?);

    // Read request line
    let mut request_line = String::new();
    reader.read_line(&mut request_line).ok()?;
    let mut parts = request_line.trim().splitn(3, ' ');
    let method = parts.next()?.to_string();
    let path = parts.next()?.to_string();

    // Read headers
    let mut content_length: usize = 0;
    loop {
        let mut header = String::new();
        reader.read_line(&mut header).ok()?;
        let h = header.trim();
        if h.is_empty() {
            break;
        }
        let lower = h.to_ascii_lowercase();
        if let Some(rest) = lower.strip_prefix("content-length:") {
            content_length = rest.trim().parse().unwrap_or(0);
        }
    }

    // Read body
    let mut body = vec![0u8; content_length];
    if content_length > 0 {
        reader.read_exact(&mut body).ok()?;
    }

    Some((method, path, content_length, body))
}

fn http_response(stream: &mut TcpStream, status: u16, body: &str) {
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        405 => "Method Not Allowed",
        500 => "Internal Server Error",
        _ => "Unknown",
    };
    let response = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{}",
        status, reason, body.len(), body
    );
    let _ = stream.write_all(response.as_bytes());
}

// ── Request handler ───────────────────────────────────────────────────────────

fn handle_connection(mut stream: TcpStream) {
    let Some((method, path, _, body)) = read_http_request(&mut stream) else {
        return;
    };

    match (method.as_str(), path.as_str()) {
        // ── Health check ──────────────────────────────────────────────────────
        ("GET", "/health") => {
            let payload = format!(
                r#"{{"status":"ok","version":"{}"}}"#,
                env!("CARGO_PKG_VERSION")
            );
            http_response(&mut stream, 200, &payload);
        }

        // ── Graph evaluation ──────────────────────────────────────────────────
        ("POST", "/evaluate") => {
            let snapshot_json = match std::str::from_utf8(&body) {
                Ok(s) => s.to_string(),
                Err(_) => {
                    http_response(&mut stream, 400, r#"{"error":"[SERVE_ENCODING] body is not valid UTF-8"}"#);
                    return;
                }
            };

            match engine_core::run(&snapshot_json) {
                Ok(result) => {
                    match serde_json::to_string(&result) {
                        Ok(json) => http_response(&mut stream, 200, &json),
                        Err(e) => {
                            let msg = format!(r#"{{"error":"[SERVE_SERIALIZE] {}"}}"#, e);
                            http_response(&mut stream, 500, &msg);
                        }
                    }
                }
                Err(e) => {
                    let msg = format!(r#"{{"error":"[SERVE_EVAL] {}"}}"#, e.message);
                    http_response(&mut stream, 400, &msg);
                }
            }
        }

        // ── CORS preflight ─────────────────────────────────────────────────────
        ("OPTIONS", _) => {
            let response = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST, GET, OPTIONS\r\nAccess-Control-Allow-Headers: content-type\r\nConnection: close\r\n\r\n";
            let _ = stream.write_all(response.as_bytes());
        }

        // ── 404 ────────────────────────────────────────────────────────────────
        _ => {
            http_response(&mut stream, 404, r#"{"error":"not found"}"#);
        }
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

fn main() {
    // Parse --port flag or PORT env var
    let port: u16 = {
        let args: Vec<String> = std::env::args().collect();
        let flag_idx = args.iter().position(|a| a == "--port");
        if let Some(idx) = flag_idx {
            args.get(idx + 1)
                .and_then(|s| s.parse().ok())
                .unwrap_or(3099)
        } else {
            std::env::var("PORT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(3099)
        }
    };

    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).unwrap_or_else(|e| {
        eprintln!("[serve] Failed to bind {}: {}", addr, e);
        std::process::exit(1);
    });

    eprintln!("[serve] engine-core HTTP server listening on {}", addr);

    let _listener = Arc::new(listener);

    for stream in _listener.incoming() {
        match stream {
            Ok(s) => {
                thread::spawn(move || handle_connection(s));
            }
            Err(e) => {
                eprintln!("[serve] Connection error: {}", e);
            }
        }
    }
}
