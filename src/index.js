function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function extractDocumentId(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== 'docs.google.com') return null;
    const match = url.pathname.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

async function handleGoogleDoc(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, { status: 405 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, { status: 400 });
  }

  const documentId = extractDocumentId(payload?.url || '');
  if (!documentId) {
    return json({ error: 'Use a normal Google Docs sharing link containing /document/d/.../edit.' }, { status: 400 });
  }

  const exportUrl = `https://docs.google.com/document/d/${documentId}/export?format=txt`;
  const response = await fetch(exportUrl, {
    headers: { 'User-Agent': 'MetaMorph/1.0' },
    redirect: 'follow',
  });

  if (!response.ok) {
    return json({
      error: 'Could not read this Google Doc. Set sharing to “Anyone with the link · Viewer” and try again.',
    }, { status: 400 });
  }

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (contentType.includes('text/html') && /accounts\.google\.com|sign in/i.test(text)) {
    return json({
      error: 'This Google Doc is not publicly readable. Set sharing to “Anyone with the link · Viewer”.',
    }, { status: 403 });
  }

  return json({ text });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/google-doc') {
      return handleGoogleDoc(request);
    }

    return env.ASSETS.fetch(request);
  },
};
