const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough, Writable } = require('node:stream');
const { decodeSessionId, promptForAuthentication } = require('../utils/authPrompt');

function runPrompt(lines) {
  let outputText = '';
  const input = new PassThrough();
  const output = new Writable({
    write(chunk, encoding, callback) {
      outputText += chunk.toString();
      callback();
    },
  });
  const result = promptForAuthentication({ input, output });
  let delay = 5;
  for (const [index, line] of lines.entries()) {
    setTimeout(() => {
      input.write(`${line}\n`);
      if (index === lines.length - 1) input.end();
    }, delay);
    delay += 5;
  }
  return {
    result,
    getOutput: () => outputText,
  };
}

test('option 1 requests a country-coded number for pairing', async () => {
  const prompt = runPrompt(['1', '+254 712-345-678']);
  assert.deepEqual(await prompt.result, { mode: 'pairing', phoneNumber: '254712345678' });
  assert.match(prompt.getOutput(), /1\) Enter a WhatsApp number and generate a pairing code/);
  assert.match(prompt.getOutput(), /2\) Paste a WhatsApp session ID/);
});

test('option 2 decodes a pasted SPOILER-MD session ID', async () => {
  const credentials = { registered: true, noiseKey: { private: 'test' } };
  const sessionId = `SPOILER-MD:~${Buffer.from(JSON.stringify(credentials)).toString('base64')}`;
  const prompt = runPrompt(['2', sessionId]);
  const selected = await prompt.result;
  assert.equal(selected.mode, 'session');
  assert.deepEqual(JSON.parse(selected.credentials.toString('utf8')), credentials);
});

test('option 2 accepts the legacy SPOILER X session ID emitted by this bot', async () => {
  const credentials = { registered: true, identity: 'legacy' };
  const sessionId = `SPOILER X :~${Buffer.from(JSON.stringify(credentials)).toString('base64')}`;
  const prompt = runPrompt(['2', sessionId]);
  const selected = await prompt.result;
  assert.equal(selected.mode, 'session');
  assert.deepEqual(JSON.parse(selected.credentials.toString('utf8')), credentials);
});

test('invalid choices and malformed session IDs are rejected before accepting valid input', async () => {
  const credentials = { registered: true, identity: 'ok' };
  const sessionId = Buffer.from(JSON.stringify(credentials)).toString('base64');
  const prompt = runPrompt(['9', '2', 'not-a-session', sessionId]);
  const selected = await prompt.result;
  assert.equal(selected.mode, 'session');
  assert.match(prompt.getOutput(), /Please choose 1 or 2/);
  assert.match(prompt.getOutput(), /could not be decoded/);
});

test('session decoder rejects non-JSON input', () => {
  assert.throws(() => decodeSessionId(Buffer.from('not JSON').toString('base64')), /could not be decoded/);
});
