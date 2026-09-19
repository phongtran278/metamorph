// MetaMorph restore policy: only these four metadata fields may be changed.
// Extra fields present in Google Docs are intentionally ignored.
// We update both the PDF Info dictionary and the XMP metadata packet because
// Acrobat/Affinity can display values from either layer.


// A blank source Title means the original PDF had no title. Remove only
// an unwanted Affinity-added title; never invent/overwrite a nonblank title.
function shouldClearTitle(metadata) {
  return Object.prototype.hasOwnProperty.call(metadata, 'Title')
    && metadata.Title === '';
}

function clearInfoTitle(pdfDoc) {
  const { PDFName, PDFDict } = window.PDFLib;
  const infoRef = pdfDoc.context.trailerInfo.Info;
  if (!infoRef) return;
  const info = pdfDoc.context.lookup(infoRef, PDFDict);
  if (info) info.delete(PDFName.of('Title'));
}

function clearXmpTitle(xmp) {
  // dc:title typically contains rdf:Alt / rdf:li multilingual title values.
  // Remove the complete title element rather than leaving an empty XMP title.
  return xmp
    .replace(/<dc:title\\b[^>]*>[\\s\\S]*?<\\/dc:title\\s*>/gi, '')
    .replace(/<dc:title\\b[^>]*\\/\\s*>/gi, '')
    .replace(/\\s+dc:title\\s*=\\s*(["'])[^"']*\\1/gi, '');
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmpDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
}

function ensureNamespace(xmp, prefix, uri) {
  if (new RegExp(`xmlns:${prefix}=["']`, 'i').test(xmp)) return xmp;
  return xmp.replace(/<rdf:Description\b/i, `<rdf:Description xmlns:${prefix}="${uri}"`);
}

function setXmpElement(xmp, tagName, value) {
  const escaped = escapeXml(value);
  const paired = new RegExp(`<${tagName}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tagName}>`, 'i');
  const selfClosing = new RegExp(`<${tagName}(?:\\s[^>]*)?\\s*\/>`, 'i');
  const replacement = `<${tagName}>${escaped}</${tagName}>`;

  if (paired.test(xmp)) return xmp.replace(paired, replacement);
  if (selfClosing.test(xmp)) return xmp.replace(selfClosing, replacement);

  const closingDescription = /<\/rdf:Description>/i;
  if (closingDescription.test(xmp)) {
    return xmp.replace(closingDescription, `${replacement}</rdf:Description>`);
  }

  return xmp;
}

function buildMinimalXmp(metadata, creationDate, modDate) {
  const creator = 'Creator' in metadata ? metadata.Creator || '' : '';
  const producer = 'Producer' in metadata ? metadata.Producer || '' : '';
  const created = creationDate ? xmpDate(creationDate) : '';
  const modified = modDate ? xmpDate(modDate) : '';

  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">\n` +
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n` +
    `<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">\n` +
    `<xmp:CreatorTool>${escapeXml(creator)}</xmp:CreatorTool>\n` +
    `<pdf:Producer>${escapeXml(producer)}</pdf:Producer>\n` +
    `<xmp:CreateDate>${escapeXml(created)}</xmp:CreateDate>\n` +
    `<xmp:ModifyDate>${escapeXml(modified)}</xmp:ModifyDate>\n` +
    `</rdf:Description>\n</rdf:RDF>\n</x:xmpmeta>\n<?xpacket end="w"?>`;
}

function updateXmpMetadata(pdfDoc, metadata, creationDate, modDate) {
  const { PDFName, PDFRawStream, decodePDFRawStream } = window.PDFLib || {};
  if (!PDFName) return;

  let xmp = '';
  const metadataRef = pdfDoc.catalog.get(PDFName.of('Metadata'));

  try {
    if (metadataRef && PDFRawStream && decodePDFRawStream) {
      const stream = pdfDoc.context.lookup(metadataRef);
      if (stream instanceof PDFRawStream) {
        const bytes = decodePDFRawStream(stream).decode();
        xmp = new TextDecoder('utf-8').decode(bytes);
      }
    }
  } catch (error) {
    console.warn('MetaMorph could not decode the existing XMP packet; a minimal packet will be written.', error);
  }

  if (!xmp || !/<rdf:RDF\b/i.test(xmp)) {
    xmp = buildMinimalXmp(metadata, creationDate, modDate);
  } else {
    xmp = ensureNamespace(xmp, 'xmp', 'http://ns.adobe.com/xap/1.0/');
    xmp = ensureNamespace(xmp, 'pdf', 'http://ns.adobe.com/pdf/1.3/');

    if ('Creator' in metadata) {
      xmp = setXmpElement(xmp, 'xmp:CreatorTool', metadata.Creator || '');
    }
    if ('Producer' in metadata) {
      xmp = setXmpElement(xmp, 'pdf:Producer', metadata.Producer || '');
    }
    if ('CreationDate' in metadata && creationDate) {
      xmp = setXmpElement(xmp, 'xmp:CreateDate', xmpDate(creationDate));
    }
    if ('ModDate' in metadata && modDate) {
      xmp = setXmpElement(xmp, 'xmp:ModifyDate', xmpDate(modDate));
      // Keep XMP's metadata timestamp aligned with the requested modified date.
      xmp = setXmpElement(xmp, 'xmp:MetadataDate', xmpDate(modDate));
    }
  }

  if (shouldClearTitle(metadata)) xmp = clearXmpTitle(xmp);

  const stream = pdfDoc.context.stream(new TextEncoder().encode(xmp), {
    Type: 'Metadata',
    Subtype: 'XML',
  });
  const streamRef = pdfDoc.context.register(stream);
  pdfDoc.catalog.set(PDFName.of('Metadata'), streamRef);
}

applyMetadata = function applyMetadata(pdfDoc, metadata) {
  const creationDate = 'CreationDate' in metadata ? parsePdfDate(metadata.CreationDate) : null;
  const modDate = 'ModDate' in metadata ? parsePdfDate(metadata.ModDate) : null;

  // PDF Info dictionary
  if (shouldClearTitle(metadata)) clearInfoTitle(pdfDoc);
  if ('Creator' in metadata) {
    pdfDoc.setCreator(metadata.Creator || '');
  }
  if ('Producer' in metadata) {
    pdfDoc.setProducer(metadata.Producer || '');
  }
  if (creationDate) {
    pdfDoc.setCreationDate(creationDate);
  }
  if (modDate) {
    pdfDoc.setModificationDate(modDate);
  }

  // XMP metadata packet used by Acrobat/Affinity and other readers.
  updateXmpMetadata(pdfDoc, metadata, creationDate, modDate);
};
