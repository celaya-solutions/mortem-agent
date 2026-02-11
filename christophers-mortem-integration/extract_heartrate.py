import io
import json
import sys
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional


def _open_xml_skipping_leading_whitespace(path: str):
    """
    Open the XML file and position the stream at the first non-whitespace byte.
    This works around files that have a blank line or BOM before the XML declaration,
    which would otherwise trigger 'XML or text declaration not at start of entity'.
    """
    f = open(path, "rb")

    # Consume BOM if present.
    bom = f.read(3)
    if bom != b"\xef\xbb\xbf":
        # Not a UTF-8 BOM; rewind so these bytes are processed normally.
        f.seek(0)

    while True:
        b = f.read(1)
        if not b:
            # Empty or all-whitespace file; let the parser raise a clear error later.
            break
        if b not in b" \t\r\n":
            # Rewind one byte so the parser sees this character (likely '<').
            f.seek(-1, io.SEEK_CUR)
            break

    return f


def iter_heartrate_records(xml_path: str):
    """
    Stream through the Health export XML and yield heart rate records.
    Uses iterparse so that the full XML tree is never loaded into memory.
    """
    # We listen for 'end' events so the element is fully populated when we read it.
    # Use a file object that skips any leading BOM/whitespace before the XML declaration.
    f = _open_xml_skipping_leading_whitespace(xml_path)
    context = ET.iterparse(f, events=("end",))

    for event, elem in context:
        if elem.tag != "Record":
            # Clear non-Record elements as we go to free memory.
            elem.clear()
            continue

        record_type = elem.get("type")
        if record_type != "HKQuantityTypeIdentifierHeartRate":
            elem.clear()
            continue

        start_date = elem.get("startDate")
        value = elem.get("value")
        source_name = elem.get("sourceName")

        if start_date is None or value is None or source_name is None:
            elem.clear()
            continue

        # Extract motion context from MetadataEntry children if present.
        motion: Optional[str] = None
        for child in elem:
            if child.tag != "MetadataEntry":
                continue
            key = child.get("key") or ""
            val = child.get("value")
            if val is None:
                continue

            # Prefer explicit heart-rate motion context key if present.
            if key == "HKMetadataKeyHeartRateMotionContext" or "MotionContext" in key:
                motion = val
                break

        try:
            bpm = int(round(float(value)))
        except (TypeError, ValueError):
            elem.clear()
            continue

        yield {
            "timestamp": start_date,
            "bpm": bpm,
            "source": source_name,
            "motion": motion,
        }

        # Clear the element to keep memory usage low.
        elem.clear()


def main():
    if len(sys.argv) < 3:
        print(
            "Usage: python extract_heartrate.py <input_export.xml> <output_heartrate_clean.json>",
            file=sys.stderr,
        )
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    print(f"Reading from: {input_path}")
    print(f"Writing to:   {output_path}")

    # First pass: stream XML, collect all heart-rate records (but not the entire XML).
    records: List[Dict] = []
    count = 0

    for rec in iter_heartrate_records(input_path):
        records.append(rec)
        count += 1
        if count % 100000 == 0:
            print(f"Parsed {count} heart-rate records...", file=sys.stderr)

    print(f"Total heart-rate records parsed: {len(records)}", file=sys.stderr)

    # Sort by timestamp (ISO-8601 strings) newest first.
    records.sort(key=lambda r: r["timestamp"], reverse=True)

    # Write clean JSON array.
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    print("Done.", file=sys.stderr)


if __name__ == "__main__":
    main()

