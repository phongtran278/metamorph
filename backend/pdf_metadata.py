"""PDF metadata processing helpers for MetaMorph."""

from pathlib import Path
from typing import Mapping

from pypdf import PdfReader, PdfWriter


def write_metadata(input_path: Path, output_path: Path, metadata: Mapping[str, str]) -> None:
    """Copy a PDF and replace its document metadata."""
    reader = PdfReader(str(input_path))
    writer = PdfWriter()

    for page in reader.pages:
        writer.add_page(page)

    normalized = {
        key if key.startswith("/") else f"/{key}": str(value)
        for key, value in metadata.items()
    }
    writer.add_metadata(normalized)

    with output_path.open("wb") as file_obj:
        writer.write(file_obj)
