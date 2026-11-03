"""
SilentSOS LoRA Adapter Merging & GGUF Quantization Pipeline
Merges LoRA fine-tuned weights back into the open-weight base model,
and quantizes to GGUF (Q4_K_M) for high-speed local inference via llama.cpp
and mobile edge inference on Android devices.
"""

import os
import sys

GGUF_EXPORT_GUIDE = """
================================================================================
SilentSOS Step-by-Step GGUF Quantization & Model Merging Guide
================================================================================

Step 1: Merge LoRA weights into Base Model
-----------------------------------------
Run this Python snippet to fuse the adapters into standard HuggingFace format:

```python
import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

base_model = "Qwen/Qwen2.5-1.5B-Instruct"
lora_dir = "./trained_silentsos_lora"
output_merged = "./silentsos_merged_model"

print("Loading base model...")
tokenizer = AutoTokenizer.from_pretrained(base_model)
model = AutoModelForCausalLM.from_pretrained(
    base_model,
    torch_dtype=torch.float16,
    device_map="auto"
)

print("Merging LoRA adapters...")
model = PeftModel.from_pretrained(model, lora_dir)
model = model.merge_and_unload()

print("Saving merged model to:", output_merged)
model.save_pretrained(output_merged)
tokenizer.save_pretrained(output_merged)
print("Merge complete!")
```

Step 2: Convert Merged Model to FP16 GGUF (via llama.cpp)
-------------------------------------------------------
Clone llama.cpp and execute the conversion script:

git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
pip install -r requirements.txt

# Convert to FP16 GGUF:
python convert_hf_to_gguf.py ../silentsos_merged_model --outfile silentsos-qwen-1.5b-f16.gguf

Step 3: Quantize to 4-bit Medium Quant (Q4_K_M)
----------------------------------------------
# Build llama.cpp tools (make or cmake)
./llama-quantize silentsos-qwen-1.5b-f16.gguf silentsos-qwen-1.5b-q4_k_m.gguf q4_k_m

Step 4: Deploy Locally
----------------------
• Windows/Linux: Place `silentsos-qwen-1.5b-q4_k_m.gguf` inside `ai_engine/inference_server/models/`
• Android: Place inside `android/app/src/main/assets/models/` for local edge inference.
================================================================================
"""

def print_guide():
    print(GGUF_EXPORT_GUIDE)

if __name__ == "__main__":
    print_guide()
