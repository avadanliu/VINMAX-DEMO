import os
import http.server
import socketserver

port = int(os.environ.get("PORT", 8765))
Handler = http.server.SimpleHTTPRequestHandler
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", port), Handler) as httpd:
    print(f"Serving on port {port}")
    httpd.serve_forever()
