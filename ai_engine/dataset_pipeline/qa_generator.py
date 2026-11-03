"""
SilentSOS QA Generator & Instruction-Tuning Pair Synthesizer
Transforms raw factual documents into multi-turn, ChatML / Alpaca-formatted
instruction-tuning pairs for LoRA/QLoRA fine-tuning of open-weight LLMs.
"""

import os
import json

SYSTEM_PROMPT = (
    "You are the SilentSOS Cognitive AI Assistant, an advanced, independent on-device conversational intelligence "
    "designed to provide comprehensive general knowledge, STEM problem-solving, coding assistance, and expert "
    "emergency, medical, and personal safety guidance. You communicate empathetically, logically, and with clear, "
    "structured markdown formatting."
)

QA_TEMPLATES = {
    "Healthcare & First Aid": [
        ("How do I perform hands-only CPR on an adult who suddenly collapsed?",
         "If an adult collapses and is unresponsive:\n1. **Call Emergency Services (112 / 911 / 999):** Put the phone on speaker.\n2. **Hand Placement:** Position the heel of your hand in the center of the chest. Interlock your other hand on top.\n3. **Compress Hard and Fast:** Push down 2 inches (5 cm) at 100-120 compressions per minute.\n4. **Do Not Stop:** Continue until medical paramedics take over."),
        ("What is the immediate first aid treatment for a thermal burn?",
         "For thermal burns:\n1. **Cool with Water:** Run cool tap water over the burn for 10-20 minutes.\n2. **Avoid Ice or Ointments:** Do not use ice, butter, or toothpaste, as they cause tissue damage and trap heat.\n3. **Cover Loosely:** Use sterile non-stick dressing or clean cling film.\n4. **Seek Medical Care:** If the burn is large, charred, or on the face or joints.")
    ],
    "Emergency Response & National Dispatch": [
        ("What is the 112 emergency service in India and how does it work?",
         "The **Emergency Response Support System (ERSS - 112)** is India's unified national distress helpline.\n\n• **Services Integrated:** Police (100), Fire (101), Ambulance (108/102), and Women's Helpline (1091).\n• **Dispatch Mechanism:** Automated GPS vehicle location tracking (AVLT) dispatches the nearest patrol vehicle.\n• **Ways to Trigger:** Voice call to 112, SMS, or pressing the smartphone power button 3 times."),
        ("What is the Zero FIR rule in India?",
         "A **Zero FIR** allows a citizen to lodge a First Information Report at ANY police station, regardless of where the crime occurred or territorial jurisdiction.\n\n• The police station cannot turn you away.\n• They must register the Zero FIR and subsequently transfer it to the jurisdictional station.\n• Refusal to register is a punishable offence under Section 166A IPC / BNSS.")
    ],
    "Programming & Technology": [
        ("How does asynchronous concurrency work in Python using asyncio?",
         "In Python, **asyncio** provides single-threaded cooperative multitasking using an event loop:\n\n```python\nimport asyncio\n\nasync def fetch_telemetry():\n    print('Starting fetch...')\n    await asyncio.sleep(1)  # Non-blocking pause\n    print('Telemetry received')\n    return {'gps': '12.9716, 77.5946'}\n\nasync def main():\n    result = await fetch_telemetry()\n    print(result)\n\nasyncio.run(main())\n```\n\n• `async def` defines a coroutine.\n• `await` yields execution back to the event loop so other tasks can run concurrently during I/O waits."),
        ("How do Android background services and sensor listeners work in Kotlin?",
         "In Android, background sensor monitoring requires registering a `SensorEventListener` with `SensorManager`:\n\n```kotlin\nval sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager\nval accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)\n\nsensorManager.registerListener(object : SensorEventListener {\n    override fun onSensorChanged(event: SensorEvent) {\n        val x = event.values[0]\n        val y = event.values[1]\n        val z = event.values[2]\n        val gForce = kotlin.math.sqrt(x*x + y*y + z*z)\n        if (gForce > 13f) {\n            // Shake spike detected -> trigger emergency dispatch\n        }\n    }\n    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}\n}, accelerometer, SensorManager.SENSOR_DELAY_UI)\n```")
    ],
    "Education & Mathematics": [
        ("Can you explain Bayes' Theorem with an intuitive formula and example?",
         "**Bayes' Theorem** calculates the conditional probability of an event $A$ given prior knowledge of conditions related to the event:\n\n$$P(A|B) = \\frac{P(B|A) \\cdot P(A)}{P(B)}$$\n\n• $P(A|B)$: **Posterior Probability** (probability of hypothesis $A$ given evidence $B$).\n• $P(B|A)$: **Likelihood** (probability of evidence $B$ if hypothesis $A$ is true).\n• $P(A)$: **Prior Probability** (initial probability of $A$).\n• $P(B)$: **Marginal Probability** (total probability of evidence $B$).")
    ]
}

def generate_instruction_dataset(cleaned_corpus_path, output_jsonl):
    print("[+] Synthesizing Instruction-Tuning QA pairs (ChatML format)...")
    dataset = []

    # 1. Add curated QA pairs
    for category, pairs in QA_TEMPLATES.items():
        for user_q, asst_a in pairs:
            dataset.append({
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_q},
                    {"role": "assistant", "content": asst_a}
                ],
                "category": category
            })

    # 2. Extract synthesized QA pairs from cleaned corpus
    if os.path.exists(cleaned_corpus_path):
        with open(cleaned_corpus_path, 'r', encoding='utf-8') as f:
            records = json.load(f)

        for rec in records:
            content = rec.get('content', '')
            cat = rec.get('category', 'General Knowledge')
            src = rec.get('source', 'Authoritative Source')

            user_prompt = f"Can you explain the key safety guidelines and protocols for: {cat} based on {src}?"
            asst_reply = f"Here are the verified principles for **{cat}**:\n\n{content}\n\n*Source Reference: {src}*"

            dataset.append({
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                    {"role": "assistant", "content": asst_reply}
                ],
                "category": cat
            })

    os.makedirs(os.path.dirname(output_jsonl), exist_ok=True)
    with open(output_jsonl, 'w', encoding='utf-8') as f:
        for ex in dataset:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')

    print(f"[OK] Generated {len(dataset)} instruction-tuning training examples in {output_jsonl}")
    return dataset

if __name__ == "__main__":
    base_dir = os.path.dirname(__file__)
    cleaned_corpus = os.path.join(base_dir, "..", "datasets", "cleaned_master_corpus.json")
    out_jsonl = os.path.join(base_dir, "..", "datasets", "instruction_tuning_dataset.jsonl")
    generate_instruction_dataset(cleaned_corpus, out_jsonl)
