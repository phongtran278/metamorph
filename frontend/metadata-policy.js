// MetaMorph restore policy: only these four metadata fields may be changed.
// Extra fields present in Google Docs are intentionally ignored.

applyMetadata = function applyMetadata(pdfDoc, metadata) {
  if ('Creator' in metadata) {
    pdfDoc.setCreator(metadata.Creator || '');
  }

  if ('Producer' in metadata) {
    pdfDoc.setProducer(metadata.Producer || '');
  }

  if ('CreationDate' in metadata) {
    const creationDate = parsePdfDate(metadata.CreationDate);
    if (creationDate) pdfDoc.setCreationDate(creationDate);
  }

  if ('ModDate' in metadata) {
    const modDate = parsePdfDate(metadata.ModDate);
    if (modDate) pdfDoc.setModificationDate(modDate);
  }
};
