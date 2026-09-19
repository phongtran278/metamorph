const googleDocUrlInput = document.querySelector('#google-doc-url');
const pdfInput = document.querySelector('#pdf-input');
const metadataButton = document.querySelector('#metadata-button');
const pdfButton = document.querySelector('#pdf-button');
const metadataDescription = document.querySelector('#metadata-description');
const pdfDescription = document.querySelector('#pdf-description');
const metadataFormat = document.querySelector('#metadata-format');
const pdfFormat = document.querySelector('#pdf-format');
const statusTitle = document.querySelector('#status-title');
const statusCopy = document.querySelector('#status-copy');
const statusBadge = document.querySelector('#status-badge');
const reviewPanel = document.querySelector('#review-panel');
const reviewSummary = document.querySelector('#review-summary');
const fileList = document.querySelector('#file-list');
const clearButton = document.querySelector('#clear-button');
const processButton = document.querySelector('#process-button');

let googleDocUrl = '';
let pdfFiles = [];
let metadataMap = new Map();
let processing = false;
let loadingMetadata = false;

const normalizeFilename = (name) => name.trim().toLowerCase();

const METADATA_KEY_ALIASES = {
  title: 'Title',
  author: 'Author',
  subject: 'Subject',
  keywords: 'Keywords',
  creator: 'Creator',
  application: 'Creator',
  producer: 'Producer',
  'pdf producer': 'Producer',
  creationdate: 'CreationDate',
  created: 'CreationDate',
  moddate: 'ModDate',
  modified: 'ModDate',
};

function normalizeMetadataValue(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';

  const blankMarkers = [
    '[không có / để trống]',
    '[khong co / de trong]',
    '[none]',
    '[empty]',
    'none',
    'null',
    '—',
    '-',
  ];

  return blankMarkers.includes(trimmed.toLowerCase()) ? '' : trimmed;
}

function normalizeMetadataKey(key) {
  const canonical = String(key ?? '').trim().toLowerCase();
  return METADATA_KEY_ALIASES[canonical] || null;
}

function parseMetadataText(text) {
  const entries = new Map();
  let current = null;

  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^FILE\s*:/i.test(line)) {
      const filename = line.replace(/^FILE\s*:/i, '').trim();
      if (!filename) continue;
      current = { filename, metadata: {}, rawMetadata: {} };
      entries.set(normalizeFilename(filename), current);
      continue;
    }

    if (!current) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;

    const rawKey = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    current.rawMetadata[rawKey] = rawValue;

    const normalizedKey = normalizeMetadataKey(rawKey);
    if (!normalizedKey) continue;

    current.metadata[normalizedKey] = normalizeMetadataValue(rawValue);
  }

  return entries;
}

function parsePdfDate(value) {
  if (!value) return null;
  const text = String(value).trim();

  const pdfMatch = text.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (pdfMatch) {
    const [, year, month, day, hour, minute, second] = pdfMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
  }

  const usMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (usMatch) {
    const [, month, day, year, hourText, minute, second = '0', meridiem] = usMatch;
    let hour = Number(hourText);
    if (meridiem) {
      const upper = meridiem.toUpperCase();
      if (upper === 'PM' && hour !== 12) hour += 12;
      if (upper === 'AM' && hour === 12) hour = 0;
    }
    return new Date(Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second));
  }

  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getMatch(file) {
  return metadataMap.get(normalizeFilename(file.name)) || null;
}

function getMatchStats() {
  const matched = pdfFiles.filter((file) => getMatch(file)).length;
  return { matched, total: pdfFiles.length, missing: pdfFiles.length - matched };
}

function renderReview() {
  if (metadataMap.size === 0 || pdfFiles.length === 0) {
    reviewPanel.hidden = true;
    processButton.disabled = true;
    fileList.innerHTML = '';
    return;
  }

  reviewPanel.hidden = false;
  const { matched, total, missing } = getMatchStats();
  reviewSummary.textContent = missing === 0
    ? `${matched} of ${total} PDF${total === 1 ? '' : 's'} matched. Everything is ready.`
    : `${matched} of ${total} matched. ${missing} file${missing === 1 ? '' : 's'} still need matching metadata.`;

  fileList.innerHTML = '';

  pdfFiles.forEach((file) => {
    const match = getMatch(file);
    const row = document.createElement('div');
    row.className = `file-row ${match ? 'is-matched' : 'is-missing'}`;

    const info = document.createElement('div');
    info.className = 'file-info';

    const name = document.createElement('strong');
    name.textContent = file.name;

    const detail = document.createElement('span');
    detail.textContent = match
      ? `Producer: ${match.metadata.Producer || '—'} · Created: ${match.metadata.CreationDate || '—'} · Application: ${match.metadata.Creator || '—'}`
      : 'No matching FILE entry found in the Google Doc.';

    info.append(name, detail);

    const badge = document.createElement('span');
    badge.className = `match-badge ${match ? 'matched' : 'missing'}`;
    badge.textContent = match ? 'Matched' : 'Missing';

    row.append(info, badge);
    fileList.append(row);
  });

  processButton.disabled = missing > 0 || total === 0 || processing;
}

function updateStatus() {
  const hasMetadata = metadataMap.size > 0;

  if (hasMetadata && pdfFiles.length > 0) {
    const { matched, total, missing } = getMatchStats();
    statusTitle.textContent = missing === 0 ? 'Everything is matched.' : 'Review the file matches.';
    statusCopy.textContent = `${matched}/${total} PDFs matched to Google Docs metadata.`;
    statusBadge.textContent = missing === 0 ? 'Ready to process' : `${missing} missing`;
    renderReview();
    return;
  }

  if (hasMetadata) {
    statusTitle.textContent = 'Google Docs metadata loaded.';
    statusCopy.textContent = `${metadataMap.size} metadata record${metadataMap.size === 1 ? '' : 's'} found. Now choose your PDFs.`;
    statusBadge.textContent = '1 of 2';
    renderReview();
    return;
  }

  if (pdfFiles.length > 0) {
    statusTitle.textContent = `${pdfFiles.length} PDF${pdfFiles.length === 1 ? '' : 's'} loaded.`;
    statusCopy.textContent = 'Now paste and load the Google Docs metadata link.';
    statusBadge.textContent = '1 of 2';
    renderReview();
    return;
  }

  statusTitle.textContent = 'Nothing changes until you confirm.';
  statusCopy.textContent = 'Load the Google Doc and choose PDFs to preview matches.';
  statusBadge.textContent = 'Ready';
  renderReview();
}

async function loadGoogleDocMetadata() {
  const url = googleDocUrlInput.value.trim();
  if (!url) throw new Error('Paste a Google Docs link first.');

  loadingMetadata = true;
  metadataButton.disabled = true;
  metadataButton.textContent = 'Loading…';
  metadataFormat.textContent = 'Reading doc';
  statusTitle.textContent = 'Reading Google Docs metadata…';
  statusCopy.textContent = 'This usually takes only a moment.';
  statusBadge.textContent = 'Loading';

  try {
    const response = await fetch('/api/google-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || 'Could not read this Google Doc.');
    }

    metadataMap = parseMetadataText(payload.text || '');
    if (metadataMap.size === 0) {
      throw new Error('The Google Doc was read, but no File: entries were found.');
    }

    googleDocUrl = url;
    metadataDescription.textContent = `${metadataMap.size} metadata record${metadataMap.size === 1 ? '' : 's'} loaded from Google Docs.`;
    metadataFormat.textContent = `${metadataMap.size} loaded`;
    metadataButton.textContent = 'Reload metadata';
  } catch (error) {
    googleDocUrl = '';
    metadataMap = new Map();
    metadataDescription.textContent = error.message;
    metadataFormat.textContent = 'Could not load';
    metadataButton.textContent = 'Try again';
  } finally {
    loadingMetadata = false;
    metadataButton.disabled = false;
    updateStatus();
  }
}

metadataButton.addEventListener('click', loadGoogleDocMetadata);
googleDocUrlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !loadingMetadata) loadGoogleDocMetadata();
});

pdfButton.addEventListener('click', () => pdfInput.click());

pdfInput.addEventListener('change', () => {
  pdfFiles = Array.from(pdfInput.files ?? []).filter((file) => file.name.toLowerCase().endsWith('.pdf'));

  if (pdfFiles.length > 0) {
    const previewNames = pdfFiles.slice(0, 3).map((file) => file.name).join(', ');
    const extraCount = Math.max(0, pdfFiles.length - 3);
    pdfDescription.textContent = extraCount > 0 ? `${previewNames} + ${extraCount} more` : previewNames;
    pdfFormat.textContent = `${pdfFiles.length} selected`;
    pdfButton.textContent = 'Change PDF files';
  } else {
    pdfDescription.textContent = 'Choose the PDF files referenced in your Google Doc. You can select multiple PDFs in one go.';
    pdfFormat.textContent = 'PDF';
    pdfButton.textContent = 'Choose PDF files';
  }

  updateStatus();
});

clearButton.addEventListener('click', () => {
  googleDocUrl = '';
  pdfFiles = [];
  metadataMap = new Map();
  googleDocUrlInput.value = '';
  pdfInput.value = '';
  metadataDescription.innerHTML = 'Use a normal Google Docs sharing link. Set the document to <strong>Anyone with the link · Viewer</strong> so MetaMorph can read it.';
  pdfDescription.textContent = 'Choose the PDF files referenced in your Google Doc. You can select multiple PDFs in one go.';
  metadataFormat.textContent = 'Waiting for link';
  pdfFormat.textContent = 'PDF';
  metadataButton.textContent = 'Load metadata';
  pdfButton.textContent = 'Choose PDF files';
  updateStatus();
});

function applyMetadata(pdfDoc, metadata) {
  if ('Title' in metadata) pdfDoc.setTitle(metadata.Title || '');
  if ('Author' in metadata) pdfDoc.setAuthor(metadata.Author || '');
  if ('Subject' in metadata) pdfDoc.setSubject(metadata.Subject || '');
  if ('Keywords' in metadata) {
    const keywords = metadata.Keywords ? metadata.Keywords.split(/[,;]/).map((item) => item.trim()).filter(Boolean) : [];
    pdfDoc.setKeywords(keywords);
  }
  if ('Creator' in metadata) pdfDoc.setCreator(metadata.Creator || '');
  if ('Producer' in metadata) pdfDoc.setProducer(metadata.Producer || '');

  const creationDate = parsePdfDate(metadata.CreationDate);
  const modDate = parsePdfDate(metadata.ModDate);
  if (creationDate) pdfDoc.setCreationDate(creationDate);
  if (modDate) pdfDoc.setModificationDate(modDate);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

processButton.addEventListener('click', async () => {
  if (processing || processButton.disabled) return;
  if (window.MetaMorphPolicyReady !== true) {
    statusTitle.textContent = 'Metadata restore policy did not load.';
    statusCopy.textContent = 'Refresh the page before processing. No PDF has been changed.';
    statusBadge.textContent = 'Error';
    return;
  }
  if (!window.PDFLib || !window.JSZip) {
    statusTitle.textContent = 'Processing library failed to load.';
    statusCopy.textContent = 'Refresh the page and try again.';
    return;
  }

  processing = true;
  processButton.disabled = true;
  processButton.textContent = 'Processing…';
  statusTitle.textContent = 'Processing your PDFs…';
  statusCopy.textContent = `0/${pdfFiles.length} complete.`;
  statusBadge.textContent = 'Working';

  try {
    const zip = new JSZip();

    for (let index = 0; index < pdfFiles.length; index += 1) {
      const file = pdfFiles[index];
      const match = getMatch(file);
      if (!match) throw new Error(`Missing metadata for ${file.name}`);

      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
      applyMetadata(pdfDoc, match.metadata);
      const outputBytes = await pdfDoc.save({ updateFieldAppearances: false });
      const outputName = file.name.replace(/\.pdf$/i, '_final.pdf');
      zip.file(outputName, outputBytes);
      statusCopy.textContent = `${index + 1}/${pdfFiles.length} complete.`;
    }

    const archive = await zip.generateAsync({ type: 'blob' });
    downloadBlob(archive, `metamorph-${new Date().toISOString().slice(0, 10)}.zip`);

    statusTitle.textContent = 'Done. Your files are ready.';
    statusCopy.textContent = `${pdfFiles.length} processed PDF${pdfFiles.length === 1 ? '' : 's'} downloaded as a ZIP.`;
    statusBadge.textContent = 'Complete';
    processButton.textContent = 'Process again';
  } catch (error) {
    console.error(error);
    statusTitle.textContent = 'Something went wrong.';
    statusCopy.textContent = error.message || 'The PDFs could not be processed.';
    statusBadge.textContent = 'Error';
    processButton.textContent = 'Try again';
  } finally {
    processing = false;
    renderReview();
    processButton.disabled = getMatchStats().missing > 0 || pdfFiles.length === 0;
  }
});

updateStatus();
