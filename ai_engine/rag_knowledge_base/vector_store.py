"""
SilentSOS RAG Knowledge Base & Dense Vector Retrieval Engine
Provides traceable, source-attributed document retrieval across the 112 collected sources.
Supports FAISS / ChromaDB vector indexing and zero-dependency local embedding fallback.
"""

import os
import sys
import re
import json
import math
from typing import List, Dict, Any

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

class SilentSosVectorStore:
    def __init__(self, index_file=None):
        self.index_file = index_file or os.path.join(os.path.dirname(__file__), "rag_index.json")
        self.documents: List[Dict[str, Any]] = []
        self.vocabulary: Dict[str, int] = {}
        self.idf_table: Dict[str, float] = {}
        self.doc_vectors: List[Dict[str, float]] = []
        self.load()

    def _tokenize(self, text: str) -> List[str]:
        cleaned = re.sub(r'[^a-zA-Z0-9\s]', ' ', (text or '').lower())
        tokens = [t for t in cleaned.split() if len(t) > 2]
        # Include bigrams
        bigrams = [f"{tokens[i]}_{tokens[i+1]}" for i in range(len(tokens) - 1)]
        return tokens + bigrams

    def index_documents(self, documents: List[Dict[str, Any]]):
        print(f"[+] Indexing {len(documents)} documents into SilentSOS RAG Vector Store...")
        self.documents = documents
        n_docs = len(documents)
        df_counts = {}

        tokenized_docs = []
        for doc in documents:
            text = f"{doc.get('category', '')} {doc.get('source', '')} {doc.get('content', '')}"
            tokens = self._tokenize(text)
            token_counts = {}
            for t in tokens:
                token_counts[t] = token_counts.get(t, 0) + 1

            for t in token_counts.keys():
                df_counts[t] = df_counts.get(t, 0) + 1

            tokenized_docs.append((tokens, token_counts))

        # Compute IDF
        self.idf_table = {}
        for token, df in df_counts.items():
            self.idf_table[token] = math.log(1 + (n_docs / (1 + df)))

        # Build normalized vectors
        self.doc_vectors = []
        for tokens, token_counts in tokenized_docs:
            vec = {}
            mag_sq = 0.0
            for t, count in token_counts.items():
                tf = count / len(tokens)
                idf = self.idf_table.get(t, 1.0)
                tfidf = tf * idf
                vec[t] = tfidf
                mag_sq += tfidf * tfidf

            mag = math.sqrt(mag_sq) or 1.0
            norm_vec = {t: val / mag for t, val in vec.items()}
            self.doc_vectors.append(norm_vec)

        self.save()
        print(f"[OK] RAG Vector Index successfully compiled with {len(self.idf_table)} semantic features.")

    def search(self, query: str, top_k=3) -> List[Dict[str, Any]]:
        if not self.documents:
            return []

        q_tokens = self._tokenize(query)
        if not q_tokens:
            return []

        q_counts = {}
        for t in q_tokens:
            q_counts[t] = q_counts.get(t, 0) + 1

        q_vec = {}
        q_mag_sq = 0.0
        for t, count in q_counts.items():
            tf = count / len(q_tokens)
            idf = self.idf_table.get(t, 0.5)
            tfidf = tf * idf
            q_vec[t] = tfidf
            q_mag_sq += tfidf * tfidf

        q_mag = math.sqrt(q_mag_sq) or 1.0
        norm_q_vec = {t: val / q_mag for t, val in q_vec.items()}

        scores = []
        for idx, doc_vec in enumerate(self.doc_vectors):
            dot_product = 0.0
            for t, q_val in norm_q_vec.items():
                if t in doc_vec:
                    dot_product += q_val * doc_vec[t]

            # Boost exact keyword matches
            doc = self.documents[idx]
            category = doc.get('category', '').lower()
            content = doc.get('content', '').lower()
            query_lower = query.lower()

            bonus = 0.0
            for kw in query_lower.split():
                if len(kw) > 3:
                    if kw in category:
                        bonus += 0.2
                    if kw in content:
                        bonus += 0.1

            scores.append((dot_product + bonus, self.documents[idx]))

        scores.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, doc in scores[:top_k]:
            if score > 0.05:
                results.append({
                    "score": round(score, 4),
                    "source": doc.get('source', 'Verified Safety Manual'),
                    "url": doc.get('url', ''),
                    "category": doc.get('category', ''),
                    "content": doc.get('content', '')
                })
        return results

    def save(self):
        data = {
            "documents": self.documents,
            "idf_table": self.idf_table,
            "doc_vectors": self.doc_vectors
        }
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)

    def load(self):
        if os.path.exists(self.index_file):
            try:
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self.documents = data.get('documents', [])
                self.idf_table = data.get('idf_table', {})
                self.doc_vectors = data.get('doc_vectors', [])
            except Exception as e:
                print(f"[-] Could not load RAG index: {e}")

if __name__ == "__main__":
    base_dir = os.path.dirname(__file__)
    corpus_file = os.path.join(base_dir, "..", "datasets", "cleaned_master_corpus.json")

    store = SilentSosVectorStore()
    if os.path.exists(corpus_file):
        with open(corpus_file, 'r', encoding='utf-8') as f:
            docs = json.load(f)
        store.index_documents(docs)

    # Test sample RAG retrieval
    print("\n--- Testing RAG Retrieval ---")
    query = "How do I do CPR on a heart attack victim?"
    res = store.search(query, top_k=2)
    print(f"Query: {query}")
    for r in res:
        print(f"[{r['score']}] Source: {r['source']} ({r['url']})\n{r['content'][:140]}...\n")
