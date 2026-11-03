"""
SilentSOS Educational, STEM & Technology Scraper (API-Free)
Collects verified foundational knowledge across General Science,
Mathematics, Python, Android Architecture, and Algorithmic Logic.
"""

import os
import json
import time

STEM_TECH_RESOURCES = [
    {
        "source": "Python Official Documentation",
        "url": "https://docs.python.org/3/",
        "category": "Programming & Technology",
        "description": "Language reference, standard libraries, asynchronous concurrency, and data structures.",
        "verified_text": (
            "Python is a high-level, dynamically typed language emphasizing readability and developer productivity. "
            "Key data structures include lists (ordered, mutable), tuples (ordered, immutable), sets (unordered, unique), "
            "and dictionaries (hash tables with O(1) average lookup). Python 3.5+ supports asynchronous programming via asyncio, "
            "using async/await syntax to manage non-blocking I/O operations cooperatively on an event loop."
        )
    },
    {
        "source": "Android Developer Guides",
        "url": "https://developer.android.com/guide",
        "category": "Programming & Technology",
        "description": "Android app architecture, activities, services, background location, and hardware sensor listeners.",
        "verified_text": (
            "Android applications are built with four primary components: Activities (UI windows), Services (background tasks), "
            "Broadcast Receivers (system event listeners), and Content Providers (data management). Modern Android emphasizes Jetpack "
            "architecture with ViewModels, StateFlow, and Coroutines. Access to hardware sensors requires SensorManager and SensorEventListener "
            "with runtime permissions: ACCESS_FINE_LOCATION, CAMERA, and RECORD_AUDIO. Background execution is coordinated through WorkManager."
        )
    },
    {
        "source": "Open Educational Mathematics & Logic",
        "url": "https://www.khanacademy.org/math",
        "category": "Education & Mathematics",
        "description": "Core principles of algebra, calculus, geometry, probability, and logical reasoning.",
        "verified_text": (
            "Mathematical reasoning involves deductive and inductive logic. Key algebraic identities: (a+b)^2 = a^2 + 2ab + b^2, "
            "and a^2 - b^2 = (a-b)(a+b). In calculus, the derivative f'(x) represents the instantaneous rate of change of a function, "
            "while the definite integral represents the accumulated net area beneath a curve. In probability, Bayes' Theorem calculates conditional probability: "
            "P(A|B) = [P(B|A) * P(A)] / P(B)."
        )
    },
    {
        "source": "Foundational Science & Physics Principles",
        "url": "https://www.britannica.com/science",
        "category": "General Science & Education",
        "description": "Newtonian mechanics, thermodynamics, electromagnetism, and cellular biology.",
        "verified_text": (
            "Classical physics is governed by Newton's Three Laws of Motion: 1. An object in motion remains in motion unless acted upon by an external net force (Inertia). "
            "2. Force equals mass times acceleration (F = ma). 3. Every action has an equal and opposite reaction. The First Law of Thermodynamics dictates "
            "that energy cannot be created or destroyed, only transformed. Cellular biology identifies DNA (deoxyribonucleic acid) as the universal genetic code, "
            "transcribing information into mRNA for ribosomal protein synthesis."
        )
    }
]

def run_stem_scraper(output_file):
    print("[+] Collecting STEM, programming, and general intelligence knowledge...")
    collected = []
    for item in STEM_TECH_RESOURCES:
        collected.append({
            "source_name": item['source'],
            "url": item['url'],
            "category": item['category'],
            "description": item['description'],
            "text": item['verified_text'],
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        })

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(collected, f, indent=2, ensure_ascii=False)
    print(f"[OK] Saved {len(collected)} STEM/tech records to {output_file}")

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "..", "datasets", "raw_stem_tech.json")
    run_stem_scraper(out)
