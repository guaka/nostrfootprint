import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readableBase64} from '../src/readable-base64.js';
const encode = text => Buffer.from(text).toString('base64');
test('previews printable UTF-8 including JSON, Unicode, and markup as text',()=>{
  for(const text of ['Hello world!', '{"hello":"world"}', 'Olá 世界\nReadable text', '<script>alert(1)</script>']) {
    assert.equal(readableBase64(encode(text)),text);
    assert.equal(readableBase64(encode(text).replace(/=+$/, '')),text);
  }
});
test('rejects binary, invalid UTF-8, controls, ordinary text, and truncated payloads',()=>{
  for(const text of ['Hello world', 'abc…', '////////', 'AAAAAAA=', encode('hello\u0000world'), encode('hello\u202eworld'), 'a'.repeat(100001)]) {
    assert.equal(readableBase64(text),null);
  }
});
