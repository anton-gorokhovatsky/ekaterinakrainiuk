#!/usr/bin/env python3
"""Serve the Pages artifact with enough queue capacity for parallel browser loads."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re


class TestServer(ThreadingHTTPServer):
    request_queue_size = 128


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def send_head(self):
        path = Path(self.translate_path(self.path))
        if path.suffix != '.mp4' or not path.is_file():
            return super().send_head()
        # Pages supports byte ranges. Match that for real media seeking instead
        # of relying on an engine buffering a whole file from a 200 response.
        size = path.stat().st_size
        start, end = 0, size - 1
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', self.headers.get('Range', ''))
        if match and any(match.groups()):
            first, last = match.groups()
            if first:
                start = int(first)
                end = min(int(last), end) if last else end
            else:
                start = max(0, size - int(last))
            if start > end or start >= size:
                self.send_response(416)
                self.send_header('Content-Range', f'bytes */{size}')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return None
            self.send_response(206)
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        else:
            self.send_response(200)
        self.send_header('Content-Type', 'video/mp4')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()
        stream = path.open('rb')
        stream.seek(start)
        self.media_remaining = end - start + 1
        return stream

    def copyfile(self, source, outputfile):
        if not hasattr(self, 'media_remaining'):
            return super().copyfile(source, outputfile)
        while self.media_remaining:
            block = source.read(min(64 * 1024, self.media_remaining))
            if not block:
                break
            outputfile.write(block)
            self.media_remaining -= len(block)


if __name__ == '__main__':
    directory = Path(__file__).resolve().parent.parent / '_site' / 'ekaterinakrainiuk'
    with TestServer(('127.0.0.1', 4188), partial(Handler, directory=str(directory))) as server:
        server.serve_forever()
