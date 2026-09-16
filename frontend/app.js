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

let metadataFile = null;
let pdfFiles = [];

function updateStatus() {
  if (metadataFile && pdfFiles.length > 0) {
    statusTitle.textContent = 'Files loaded and ready to review.';
    statusCopy.textContent = `${metadataFile.name} + ${pdfFiles.length} PDF${pdfFiles.length === 1 ? '' : 's'} selected.`;
    statusBadge.textContent = 'Ready to match';
    return;
  }

  if (metadataFile) {
    statusTitle.textContent = 'Metadata source loaded.';
    statusCopy.textContent = 'Now choose one or more PDF files.';
    statusBadge.textContent = '1 of 2';
    return;
  }

  if (pdfFiles.length > 0) {
    statusTitle.textContent = `${pdfFiles.length} PDF${pdfFiles.length === 1 ? '' : 's'} loaded.`;
    statusCopy.textContent = 'Now choose the metadata text file.';
    statusBadge.textContent = '1 of 2';
    return;
  }

  statusTitle.textContent = 'Nothing changes until you confirm.';
  statusCopy.textContent = 'Upload both sources to preview matching metadata.';
  statusBadge.textContent = 'Ready';
}

metadataButton.addEventListener('click', () => metadataInput.click());
pdfButton.addEventListener('click', () => pdfInput.click());

metadataInput.addEventListener('change', () => {
  metadataFile = metadataInput.files?.[0] ?? null;

  if (metadataFile) {
    metadataDescription.textContent = metadataFile.name;
    metadataFormat.textContent = 'Selected';
    metadataButton.textContent = 'Change metadata file';
  } else {
    metadataDescription.textContent = 'Upload the text file containing the original metadata set you want to apply.';
    metadataFormat.textContent = 'TXT';
    metadataButton.textContent = 'Choose metadata file';
  }

  updateStatus();
});

pdfInput.addEventListener('change', () => {
  pdfFiles = Array.from(pdfInput.files ?? []);

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

updateStatus();
