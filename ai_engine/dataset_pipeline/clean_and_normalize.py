"""
SilentSOS Dataset Cleaning, Normalization & Deduplication Pipeline
Cleans raw extracted text, strips web noise, removes duplicates via cryptographic
content hashing, and segments content into clean training documents.
"""

import os
import re
import json
import hashlib
import unicodedata

def clean_text(text: str) -> str:
    if not text:
        return ""
    # Normalize unicode to NFKC
    normalized = unicodedata.normalize('NFKC', text)
    # Remove HTML tags if any leaked through
    stripped = re.sub(r'<[^>]+>', ' ', normalized)
    # Normalize whitespace
    collapsed = re.sub(r'\s+', ' ', stripped).strip()
    return collapsed

def compute_hash(text: str) -> str:
    normalized_for_hash = re.sub(r'[^a-zA-Z0-9]', '', text.lower())
    return hashlib.sha256(normalized_for_hash.encode('utf-8')).hexdigest()

def chunk_document(text: str, max_words=120, overlap=25):
    words = text.split()
    if len(words) <= max_words:
        return [text]

    chunks = []
    start = 0
    while start < len(words):
        end = start + max_words
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += (max_words - overlap)
    return chunks

def process_datasets(input_files, output_file):
    print("[+] Starting Dataset Normalization and Deduplication...")
    seen_hashes = set()
    cleaned_records = []
    duplicates_count = 0

    for file_path in input_files:
        if not os.path.exists(file_path):
            print(f"[-] Warning: File not found: {file_path}")
            continue

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        records = data if isinstance(data, list) else [data]
        for item in records:
            raw_text = item.get('text') or item.get('guidance') or item.get('summary') or ''
            cleaned = clean_text(raw_text)

            if len(cleaned) < 40:
                continue

            doc_hash = compute_hash(cleaned)
            if doc_hash in seen_hashes:
                duplicates_count += 1
                continue

            seen_hashes.add(doc_hash)

            chunks = chunk_document(cleaned)
            for idx, ch in enumerate(chunks):
                cleaned_records.append({
                    "id": f"{item.get('id', 'doc')}_{idx}",
                    "source": item.get('source_name') or item.get('name') or item.get('source') or 'SilentSOS Safety Corpus',
                    "url": item.get('url', ''),
                    "category": item.get('category', 'General Knowledge'),
                    "content": ch,
                    "word_count": len(ch.split())
                })

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(cleaned_records, f, indent=2, ensure_ascii=False)

    print(f"[OK] Processed {len(cleaned_records)} unique normalized knowledge segments.")
    print(f"[OK] Eliminated {duplicates_count} duplicate content chunks.")
    print(f"[OK] Output written to {output_file}")
    return cleaned_records

if __name__ == "__main__":
    base_dir = os.path.dirname(__file__)
    root_datasets = os.path.join(base_dir, "..", "datasets")
    ai_training_dataset_raw = os.path.join(base_dir, "..", "..", "ai_training_dataset", "raw_dataset")

    inputs = [
        os.path.join(root_datasets, "raw_emergency_gov.json"),
        os.path.join(root_datasets, "raw_health_disaster.json"),
        os.path.join(root_datasets, "raw_stem_tech.json")
    ]

    # Include existing 10 partitioned files from ai_training_dataset if available
    if os.path.exists(ai_training_dataset_raw):
        for f in os.listdir(ai_training_dataset_raw):
            if f.endswith('.json'):
                inputs.append(os.path.join(ai_training_dataset_raw, f))

    out = os.path.join(root_datasets, "cleaned_master_corpus.json")
    process_datasets(inputs, out)
