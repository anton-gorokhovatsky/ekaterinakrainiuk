#!/usr/bin/env python3
"""Serve the Pages artifact with enough queue capacity for parallel browser loads."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class TestServer(ThreadingHTTPServer):
    request_queue_size = 128


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


if __name__ == '__main__':
    directory = Path(__file__).resolve().parent.parent / '_site'
    with TestServer(('127.0.0.1', 4188), partial(Handler, directory=str(directory))) as server:
        server.serve_forever()
