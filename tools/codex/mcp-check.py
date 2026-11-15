#!/usr/bin/env python3
"""Verify local Playwright MCP via initialize, tools/list, and a browser operation."""
import json
from pathlib import Path
import select
import subprocess
import sys
import http.server
import threading

root = Path(__file__).resolve().parents[2]
class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        content = "<html lang='ar' dir='rtl'><title>Halaqati MCP verification</title><h1>حلقاتي</h1></html>".encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(content)
    def log_message(self, *_args):
        pass
server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
(root / ".codex-work").mkdir(exist_ok=True)
with (root / ".codex-work/mcp-stderr.log").open("w") as errors:
    process = subprocess.Popen(["bash", str(root / "tools/codex/playwright-mcp.sh")], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errors, text=True, bufsize=1)
    def send(message):
        process.stdin.write(json.dumps({"jsonrpc": "2.0", **message}) + "\n")
        process.stdin.flush()
    def call(number, method, params):
        send({"id": number, "method": method, "params": params})
        while True:
            if not select.select([process.stdout], [], [], 45)[0]:
                raise TimeoutError(f"MCP {method} timed out")
            line = process.stdout.readline()
            if not line:
                raise RuntimeError("MCP server exited; see .codex-work/mcp-stderr.log")
            result = json.loads(line)
            if result.get("id") == number:
                if "error" in result or result.get("result", {}).get("isError"):
                    raise RuntimeError(result)
                return result["result"]
    try:
        result = call(1, "initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "halaqati-setup-check", "version": "1"}})
        send({"method": "notifications/initialized"})
        names = [tool["name"] for tool in call(2, "tools/list", {})["tools"]]
        assert "browser_navigate" in names
        call(3, "tools/call", {"name": "browser_navigate", "arguments": {"url": f"http://127.0.0.1:{server.server_port}/"}})
        call(4, "tools/call", {"name": "browser_snapshot", "arguments": {}})
        call(5, "tools/call", {"name": "browser_close", "arguments": {}})
        print(f"PASS: {result['serverInfo']['name']}, {len(names)} tools; browser navigation and snapshot executed")
    finally:
        process.terminate()
        server.shutdown()
        server.server_close()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
