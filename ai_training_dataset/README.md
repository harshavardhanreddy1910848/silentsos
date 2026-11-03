# 🛡️ SilentSOS AI Training Dataset & Model Documentation

This directory contains the dataset, source citations, algorithm documentation, and training manifests for the **SilentSOS In-House Cognitive Safety Assistant**.

## 📂 Directory Contents:
- 📄 **`sources_directory.md`**: Table of all **112 authoritative sources** with direct links, organizations, and categories.
- 📋 **`sources_directory.json`**: Machine-readable JSON catalog of all 112 sources.
- 🔬 **`algorithm_and_training_details.md`**: Complete algorithmic breakdown (TF-IDF vector space model, cosine similarity, N-grams, multi-turn context resolution, Claude-style markdown formatting).
- 📦 **`raw_dataset/`**: Partitioned JSON datasets across all 10 safety sectors.
- 📊 **`training_manifest.json`**: Model metadata, training timestamp, and architectural specifications.

## 🚀 How to Retrain the Model:
```bash
node backend/ai/train_model.js
```
