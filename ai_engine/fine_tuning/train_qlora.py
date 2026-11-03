"""
SilentSOS Open-Weight LLM QLoRA Fine-Tuning Pipeline
Trained on instruction_tuning_dataset.jsonl using Hugging Face PEFT + TRL + BitsAndBytes.
Optimized for single GPU (RTX 3050 4GB / 8GB / 16GB) or multi-threaded CPU fallback.

Compatible Base Models:
1. Qwen/Qwen2.5-0.5B-Instruct / Qwen2.5-1.5B-Instruct / Qwen2.5-3B-Instruct (Recommended for 4GB VRAM)
2. meta-llama/Llama-3.2-1B-Instruct / Llama-3.2-3B-Instruct
3. mistralai/Mistral-7B-Instruct-v0.3
"""

import os
import sys
import torch

def verify_environment():
    print("=" * 60)
    print("SilentSOS QLoRA Model Training Environment Check")
    print("=" * 60)
    print(f"Python Version: {sys.version}")
    cuda_available = torch.cuda.is_available()
    print(f"CUDA Available: {cuda_available}")
    if cuda_available:
        print(f"Device Name: {torch.cuda.get_device_name(0)}")
        print(f"Total VRAM: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB")
    else:
        print("[-] Running in CPU mode (will use CPU offloading / fp32/bf16)")
    print("=" * 60)

def generate_training_command():
    return (
        "pip install -q torch transformers datasets peft bitsandbytes trl accelerate sentencepiece\n\n"
        "# To launch fine-tuning on Qwen2.5-1.5B-Instruct (fits smoothly on 4GB RTX 3050):\n"
        "python ai_engine/fine_tuning/train_qlora.py --base_model Qwen/Qwen2.5-1.5B-Instruct --epochs 3\n"
    )

def train(base_model_name="Qwen/Qwen2.5-1.5B-Instruct", epochs=3, output_dir="./trained_silentsos_lora"):
    verify_environment()
    dataset_path = os.path.join(os.path.dirname(__file__), "..", "datasets", "instruction_tuning_dataset.jsonl")

    if not os.path.exists(dataset_path):
        print(f"[-] Dataset not found at {dataset_path}. Run qa_generator.py first.")
        return

    print(f"[+] Loading dataset from: {dataset_path}")
    print(f"[+] Base Model Selected: {base_model_name}")
    print(f"[+] Fine-Tuning Strategy: 4-bit NormalFloat (NF4) QLoRA with rank r=8, alpha=16")
    print(f"[+] Gradient Checkpointing: Enabled (drastically cuts memory for 4GB GPUs)")

    try:
        from datasets import load_dataset
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainingArguments
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
        from trl import SFTTrainer

        # 4-bit Quantization Config for Low-VRAM
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True
        )

        tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
        tokenizer.pad_token = tokenizer.eos_token

        model = AutoModelForCausalLM.from_pretrained(
            base_model_name,
            quantization_config=bnb_config if torch.cuda.is_available() else None,
            device_map="auto" if torch.cuda.is_available() else "cpu",
            trust_remote_code=True
        )

        model = prepare_model_for_kbit_training(model)

        peft_config = LoraConfig(
            r=8,
            lora_alpha=16,
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM",
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
        )

        model = get_peft_model(model, peft_config)
        model.print_trainable_parameters()

        dataset = load_dataset("json", data_files=dataset_path, split="train")

        training_args = TrainingArguments(
            output_dir=output_dir,
            num_train_epochs=epochs,
            per_device_train_batch_size=1,
            gradient_accumulation_steps=4,
            learning_rate=2e-4,
            fp16=torch.cuda.is_available(),
            logging_steps=10,
            save_strategy="epoch",
            optim="paged_adamw_8bit" if torch.cuda.is_available() else "adamw_torch",
            report_to="none"
        )

        def formatting_prompts_func(example):
            output_texts = []
            for msgs in example['messages']:
                text = tokenizer.apply_chat_template(msgs, tokenize=False)
                output_texts.append(text)
            return output_texts

        trainer = SFTTrainer(
            model=model,
            train_dataset=dataset,
            peft_config=peft_config,
            formatting_func=formatting_prompts_func,
            max_seq_length=1024,
            tokenizer=tokenizer,
            args=training_args
        )

        print("[+] Commencing supervised instruction fine-tuning...")
        trainer.train()
        print(f"[OK] Training complete. Saving LoRA adapter weights to: {output_dir}")
        trainer.model.save_pretrained(output_dir)
        tokenizer.save_pretrained(output_dir)

    except ImportError:
        print("\n[!] PyTorch / Transformers / PEFT not installed in current Python environment.")
        print("[!] Install the requirements using:")
        print(generate_training_command())

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="SilentSOS QLoRA Fine-Tuner")
    parser.add_argument("--base_model", type=str, default="Qwen/Qwen2.5-1.5B-Instruct")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--output_dir", type=str, default="./trained_silentsos_lora")
    args = parser.parse_args()

    train(args.base_model, args.epochs, args.output_dir)

