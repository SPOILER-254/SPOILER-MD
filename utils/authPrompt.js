const readline = require('readline');

function decodeSessionId(sessionId) {
  const value = String(sessionId || '').trim().replace(/^SPOILER-MD:~/, '');
  if (!value || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) {
    throw new Error('That does not look like a valid SPOILER-MD session ID.');
  }

  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length) throw new Error('The session ID is empty or invalid.');

  let credentials;
  try {
    credentials = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('The session ID could not be decoded. Paste the complete session ID.');
  }
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
    throw new Error('The session ID does not contain valid WhatsApp credentials.');
  }
  if (credentials.registered !== true) {
    throw new Error('The session ID does not contain a registered WhatsApp session.');
  }

  return bytes;
}

function promptForAuthentication({ input = process.stdin, output = process.stdout } = {}) {
  const rl = readline.createInterface({ input, output });

  const ask = (question) => new Promise((resolve, reject) => {
    if (rl.closed) {
      reject(new Error('Input closed before authentication was selected.'));
      return;
    }
    let settled = false;
    const onClose = () => {
      if (!settled) reject(new Error('Input closed before authentication was selected.'));
    };
    rl.once('close', onClose);
    rl.question(question, (answer) => {
      settled = true;
      rl.removeListener('close', onClose);
      resolve(answer.trim());
    });
  });

  return (async () => {
    try {
      while (true) {
        output.write('\nWhatsApp authentication is not set up yet. Choose a login method:\n');
        output.write('  1) Enter a WhatsApp number and generate a pairing code\n');
        output.write('  2) Paste a WhatsApp session ID\n');
        const choice = await ask('Choose 1 or 2: ');

        if (choice === '1') {
          while (true) {
            const phoneInput = await ask('Enter your WhatsApp number with country code (digits only, e.g. 254712345678): ');
            const phoneNumber = phoneInput.replace(/\D/g, '');
            if (phoneNumber.length >= 8 && phoneNumber.length <= 15) {
              return { mode: 'pairing', phoneNumber };
            }
            output.write('Please enter a valid international WhatsApp number (8–15 digits).\n');
          }
        }

        if (choice === '2') {
          while (true) {
            const sessionId = await ask('Paste your complete session ID: ');
            try {
              return { mode: 'session', credentials: decodeSessionId(sessionId) };
            } catch (error) {
              output.write(`${error.message}\n`);
            }
          }
        }

        output.write('Please choose 1 or 2.\n');
      }
    } finally {
      rl.close();
    }
  })();
}

module.exports = { decodeSessionId, promptForAuthentication };
