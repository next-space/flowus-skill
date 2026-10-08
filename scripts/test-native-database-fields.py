#!/usr/bin/env python3
"""Run the shipped recipe through an explicit CLI binary against loopback fixtures."""
import argparse
import http.server
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import threading

PRODUCT = 'flowus'
IDS = {
    'SOURCE_DATABASE_ID': '33333333-3333-4333-8333-333333333333',
    'TARGET_DATABASE_ID': '99999999-9999-4999-8999-999999999999',
    'SOURCE_RECORD_ID': '77777777-7777-4777-8777-777777777777',
    'TARGET_RECORD_ID': '88888888-8888-4888-8888-888888888888',
    'FORMULA_PROPERTY_ID': 'weighted',
    'RELATION_PROPERTY_ID': 'client',
    'TARGET_AMOUNT_PROPERTY_ID': 'amount',
}
calls = []
bodies = []
failures = []


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        self.handle_request()

    def do_POST(self):
        self.handle_request()

    def do_PATCH(self):
        self.handle_request()

    def handle_request(self):
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
        calls.append((self.command, self.path))
        try:
            if self.command in ('POST', 'PATCH'):
                bodies.append(body)
            if self.command == 'POST' and self.path == '/v2/pages':
                assert self.headers.get('Idempotency-Key') == 'recipe-record-1'
            if self.path == '/v2/users/me':
                data = {'object': 'user', 'id': IDS['TARGET_RECORD_ID'], 'type': 'bot', 'name': 'Fixture'}
            elif self.path.startswith('/v2/databases/') and self.path.endswith('/query'):
                assert body == {'page_size': 10}
                data = {'object': 'list', 'results': [record()], 'has_more': False, 'next_cursor': None}
            elif '/properties/' in self.path:
                data = {'object': 'property_item', 'id': 'weighted', 'type': 'formula', 'formula': {'type': 'number', 'number': 600}}
            elif self.path.startswith('/v2/databases/'):
                data = {'object': 'database', 'id': self.path.split('/')[3], 'properties': {
                    'Client': {'id': 'client', 'type': 'relation'},
                    'Weighted': {'id': 'weighted', 'type': 'formula'},
                    'Amount': {'id': 'amount', 'type': 'number'},
                }}
            else:
                data = record()
            payload = json.dumps(data).encode()
            self.send_response(200)
        except AssertionError:
            failures.append({'method': self.command, 'path': self.path})
            payload = json.dumps({'code': 'fixture_mismatch', 'message': 'Recipe request did not match the fixture contract.'}).encode()
            self.send_response(400)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def record():
    return {'object': 'page', 'id': IDS['SOURCE_RECORD_ID'], 'properties': {
        'Client': {'type': 'relation', 'relation': [{'id': IDS['TARGET_RECORD_ID']}]},
        'Weighted': {'type': 'formula', 'formula': {'type': 'number', 'number': 600}},
    }}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--binary', type=Path, required=True, help='Explicit compiled CLI; never installs or updates.')
    args = parser.parse_args()
    binary = args.binary.resolve()
    reference = Path(__file__).resolve().parents[1] / 'skills' / (PRODUCT + '-cli') / 'references/native-database-fields.md'
    recipe = reference.read_text()
    blocks = re.findall(r'[\x60]{3}json\n(.*?)\n[\x60]{3}', recipe, re.S)
    assert len(blocks) == 5
    docs = []
    for block in blocks:
        for key, value in IDS.items():
            block = block.replace(key, value)
        docs.append(json.loads(block))
    assert docs[0]['properties']['Weighted']['formula']['expression'] == 'prop("Amount") * 0.6'
    assert docs[1]['properties']['Total']['rollup']['relation_property_id'] == 'client'
    assert docs[2]['properties']['Name']['title'][0]['annotations']['text_color'] == 'default'
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with tempfile.TemporaryDirectory(prefix=PRODUCT + '-recipe-') as tmp:
            env = os.environ.copy()
            for name in list(env):
                if name.upper().endswith('_TOKEN') or name.lower().endswith('_proxy'):
                    env.pop(name)
            env[PRODUCT.upper() + '_TOKEN'] = 'synthetic-loopback-fixture-token'
            env[PRODUCT.upper() + '_CONFIG_DIR'] = tmp
            prefix = [str(binary), '--base-url', 'http://127.0.0.1:' + str(server.server_port)]
            def run(*argv):
                result = subprocess.run(prefix + list(argv), env=env, capture_output=True, text=True, timeout=30)
                assert result.returncode == 0, 'CLI failed for ' + ' '.join(argv) + ': ' + result.stderr[:300]
                if argv[0] != '--json':
                    return result.stdout
                envelope = json.loads(result.stdout)
                assert envelope.get('ok') is True, 'Expected successful JSON envelope.'
                return envelope['data']
            for command in [('database', 'update'), ('page', 'create'), ('page', 'update'), ('page', 'property', 'get')]:
                run('help', *command)
            run('api', '--docs', '/v2/databases/{database_id}', '-X', 'PATCH')
            run('--json', 'doctor')
            run('--json', 'whoami')
            for database in ['SOURCE_DATABASE_ID', 'TARGET_DATABASE_ID']:
                run('--json', 'database', 'get', IDS[database])
            names = ['schema.json', 'rollup-schema.json', 'record.json', 'relation-values.json', 'query.json']
            for name, body in zip(names, docs):
                (Path(tmp)/name).write_text(json.dumps(body))
            file = lambda name: str(Path(tmp)/name)
            run('--json', 'database', 'update', IDS['SOURCE_DATABASE_ID'], '--body', file(names[0]))
            run('--json', 'database', 'update', IDS['SOURCE_DATABASE_ID'], '--body', file(names[1]))
            created = run('--json', 'page', 'create', '--body', file(names[2]), '--idempotency-key', 'recipe-record-1')
            assert created['id'] == IDS['SOURCE_RECORD_ID']
            run('--json', 'page', 'update', created['id'], '--body', file(names[3]))
            query = run('--json', 'database', 'query', IDS['SOURCE_DATABASE_ID'], '--body', file(names[4]))
            page = run('--json', 'page', 'get', created['id'])
            prop = run('--json', 'page', 'property', 'get', created['id'], IDS['FORMULA_PROPERTY_ID'])
            formula = {'type': 'number', 'number': 600}
            assert query['results'][0]['properties']['Weighted']['formula'] == formula
            assert page['properties']['Weighted']['formula'] == formula
            assert prop['formula'] == formula
            assert query['has_more'] is False
            assert page['properties']['Client']['relation'][0]['id'] == IDS['TARGET_RECORD_ID']
            assert bodies == docs, 'The CLI must forward every recipe request without rewriting its values.'
            assert not failures
            print(json.dumps({'product': PRODUCT, 'status': 'passed', 'httpCalls': len(calls), 'writeBodies': len(bodies), 'real': ['compiled CLI', 'HTTP', 'recipe JSON'], 'mocked': ['API storage', 'formula result', 'authorization']}))
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
