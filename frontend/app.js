const metadataInput = document.querySelector('#metadata-input');
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

let metadataFile = null;
let pdfFiles = [];
let metadataMap = new Map();
let processing = false;

const normalizeFilename = (name) => name.trim().toLowerCase();

function parseMetadataText(text) {
  const entries = new Map();
  let current = null;

  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^FILE\s*:/i.test(line)) {
      const filename = line.replace(/^FILE\s*:/i, '').trim();
      if (!filename) continue;
      current = { filename, metadata: {} };
      entries.set(normalizeFilename(filename), current);
      continue;
    }

    if (!current) continue;

    const separator = line.indexOf(':');
    if (separator < 0) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    current.metadata[key] = value;
  }

  return entries;
}

function parsePdfDate(value) {
  if (!value) return null;
  const match = value.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ));
}

function getMatch(file) {
  return metadataMap.get(normalizeFilename(file.name)) || null;
}

function getMatchStats() {
  const matched = pdfFiles.filter((file) => getMatch(file)).length;
  return { matched, total: pdfFiles.length, missing: pdfFiles.length - matched };
}

function renderReview() {
  if (!metadataFile || pdfFiles.length === 0) {
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
      ? `Producer: ${match.metadata.Producer || '—'} · CreationDate: ${match.metadata.CreationDate || '—'}`
      : 'No matching FILE entry found in the metadata source.';

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
  if (metadataFile && pdfFiles.length > 0) {
    const { matched, total, missing } = getMatchStats();
    statusTitle.textContent = missing === 0 ? 'Everything is matched.' : 'Review the file matches.';
    statusCopy.textContent = `${matched}/${total} PDFs matched to metadata.`;
    statusBadge.textContent = missing === 0 ? 'Ready to process' : `${missing} missing`;
    renderReview();
    return;
  }

  if (metadataFile) {
    statusTitle.textContent = 'Metadata source loaded.';
    statusCopy.textContent = `${metadataMap.size} metadata record${metadataMap.size === 1 ? '' : 's'} found. Now choose your PDFs.`;
    statusBadge.textContent = '1 of 2';
    renderReview();
    return;
  }

  if (pdfFiles.length > 0) {
    statusTitle.textContent = `${pdfFiles.length} PDF${pdfFiles.length === 1 ? '' : 's'} loaded.`;
    statusCopy.textContent = 'Now choose the metadata text file.';
    statusBadge.textContent = '1 of 2';
    renderReview();
    return;
  }

  statusTitle.textContent = 'Nothing changes until you confirm.';
  statusCopy.textContent = 'Upload both sources to preview matching metadata.';
  statusBadge.textContent = 'Ready';
  renderReview();
}

async function loadMetadata(file) {
  const text = await file.text();
  metadataMap = parseMetadataText(text);
  if (metadataMap.size === 0) {
    throw new Error('No FILE: entries were found in this metadata file.');
  }
}

metadataButton.addEventListener('click', () => metadataInput.click());
pdfButton.addEventListener('click', () => pdfInput.click());

metadataInput.addEventListener('change', async () => {
  metadataFile = metadataInput.files?.[0] ?? null;
  metadataMap = new Map();

  if (metadataFile) {
    try {
      await loadMetadata(metadataFile);
      metadataDescription.textContent = `${metadataFile.name} · ${metadataMap.size} record${metadataMap.size === 1 ? '' : 's'}`;
      metadataFormat.textContent = 'Selected';
      metadataButton.textContent = 'Change metadata file';
    } catch (error) {
      metadataDescription.textContent = error.message;
      metadataFormat.textContent = 'Invalid';
      metadataButton.textContent = 'Choose another file';
    }
  } else {
    metadataDescription.textContent = 'Upload the text file containing the original metadata set you want to apply.';
    metadataFormat.textContent = 'TXT';
    metadataButton.textContent = 'Choose metadata file';
  }

  updateStatus();
});

pdfInput.addEventListener('change', () => {
  pdfFiles = Array.from(pdfInput.files ?? []).filter((file) => file.name.toLowerCase().endsWith('.pdf'));

  if (pdfFiles.length > 0) {
    const previewNames = pdfFiles.slice(0, 3).map((file) => file.name).join(', ');
    const extraCount = Math.max(0, pdfFiles.length - 3);
    pdfDescription.textContent = extraCount > 0
      ? `${previewNames} + ${extraCount} more`
      : previewNames;
    pdfFormat.textContent = `${pdfFiles.length} selected`;
    pdfButton.textContent = 'Change PDF files';
  } else {
    pdfDescription.textContent = 'Select one or many PDF files. MetaMorph will match each file with its metadata before anything is changed.';
    pdfFormat.textContent = 'PDF';
    pdfButton.textContent = 'Choose PDF files';
  }

  updateStatus();
});

clearButton.addEventListener('click', () => {
  metadataFile = null;
  pdfFiles = [];
  metadataMap = new Map();
  metadataInput.value = '';
  pdfInput.value = '';
  metadataDescription.textContent = 'Upload the text file containing the original metadata set you want to apply.';
  pdfDescription.textContent = 'Select one or many PDF files. MetaMorph will match each file with its metadata before anything is changed.';
  metadataFormat.textContent = 'TXT';
  pdfFormat.textContent = 'PDF';
  metadataButton.textContent = 'Choose metadata file';
  pdfButton.textContent = 'Choose PDF files';
  updateStatus();
});

function applyMetadata(pdfDoc, metadata) {
  if ('Title' in metadata) pdfDoc.setTitle(metadata.Title || '');
  if ('Author' in metadata) pdfDoc.setAuthor(metadata.Author || '');
  if ('Subject' in metadata) pdfDoc.setSubject(metadata.Subject || '');
  if ('Keywords' in metadata) {
    const keywords = metadata.Keywords
      ? metadata.Keywords.split(/[,;]/).map((item) => item.trim()).filter(Boolean)
      : [];
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
