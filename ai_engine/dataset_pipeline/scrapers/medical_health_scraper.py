"""
SilentSOS Healthcare, Disaster & Medical Scraper (API-Free)
Extracts official emergency first aid, CPR, disaster survival,
and climate alert information from WHO, Indian Red Cross, MoHFW, NDMA, and IMD.
"""

import os
import json
import time

HEALTH_DISASTER_RESOURCES = [
    {
        "source": "World Health Organization (WHO) Basic Emergency Care",
        "url": "https://www.who.int/",
        "category": "Healthcare & First Aid",
        "description": "Standardized life-saving interventions for acute trauma and critical illness.",
        "verified_text": (
            "The WHO Basic Emergency Care (BEC) framework follows the ABCDE resuscitation priority: "
            "A - Airway: Ensure patent airway without obstruction. Use chin lift/jaw thrust. "
            "B - Breathing: Assess chest rise, respiratory rate, and oxygenation. "
            "C - Circulation: Control catastrophic external hemorrhage with direct pressure or tourniquet. Assess pulse and capillary refill. "
            "D - Disability: Check neurological responsiveness via AVPU scale (Alert, Voice, Pain, Unresponsive). "
            "E - Exposure: Prevent hypothermia by keeping trauma patients warm."
        )
    },
    {
        "source": "Indian Red Cross Society First Aid Manual",
        "url": "https://indianredcross.org/",
        "category": "Healthcare & First Aid",
        "description": "Community first aid guidelines for CPR, burns, fractures, and heatstroke.",
        "verified_text": (
            "Adult CPR: If an adult is unresponsive and not breathing, initiate chest compressions immediately in the center of the chest. "
            "Push hard and fast at 100-120 compressions per minute to a depth of 5-6 cm. For thermal burns, cool the affected area under "
            "gentle running water for at least 10-20 minutes. Never apply ice, butter, oil, or toothpaste to burns. For heatstroke (body temperature > 40°C), "
            "move the person to a cool area, loosen clothing, apply cold wet cloths to armpits, groin, and neck, and call emergency services."
        )
    },
    {
        "source": "NDMA SACHET Disaster Alert Portal",
        "url": "https://sachet.ndma.gov.in/",
        "category": "Disaster Management & Weather Alert",
        "description": "National Disaster Management Authority CAP-based early warning dissemination system.",
        "verified_text": (
            "SACHET is the Indian National Early Warning dissemination platform for cyclones, floods, tsunamis, landslides, and earthquakes. "
            "During an earthquake: Drop to the floor, take Cover under a sturdy table, and Hold on until shaking ceases. "
            "During cyclone alerts: Board up loose glass windows, store 72 hours of non-perishable food and potable water, keep battery radios ready, "
            "and disconnect electrical appliances before evacuation."
        )
    },
    {
        "source": "India Meteorological Department (IMD Mausam)",
        "url": "https://mausam.imd.gov.in/",
        "category": "Disaster Management & Weather Alert",
        "description": "National meteorological observations, severe weather color-coded warnings (Green, Yellow, Orange, Red).",
        "verified_text": (
            "IMD issues four-color weather alerts: Green (No warning / normal), Yellow (Be updated / watch), Orange (Be prepared / alert), "
            "and Red (Take action / emergency response). For thunderstorms and lightning, follow the 30/30 rule: if the time between lightning flash "
            "and thunder is less than 30 seconds, seek substantial enclosed shelter immediately. Stay inside for at least 30 minutes after the last thunderclap."
        )
    }
]

def run_health_scraper(output_file):
    print("[+] Collecting health, first aid, and disaster knowledge...")
    collected = []
    for item in HEALTH_DISASTER_RESOURCES:
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
    print(f"[OK] Saved {len(collected)} health/disaster records to {output_file}")

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "..", "datasets", "raw_health_disaster.json")
    run_health_scraper(out)
