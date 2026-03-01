"""
Build a final prompt string from the JSON template.

Usage:
    python build_prompt.py                          # Use default subject
    python build_prompt.py --subject subject.json   # Override subject block
    python build_prompt.py --template my-template.json  # Use custom template

The subject JSON file should contain only the "subject" keys, e.g.:
{
    "description": "Male fitness model, late 20s",
    "body_type": "muscular and lean, athletic build",
    "attire": "grey joggers, no shirt",
    ...
}
"""

import argparse
import json
import sys
from pathlib import Path


def load_template(template_path: str = None) -> dict:
    path = Path(template_path or Path(__file__).parent / "image-prompt-template.json")
    with open(path) as f:
        return json.load(f)


def load_subject_override(subject_path: str) -> dict:
    with open(subject_path) as f:
        return json.load(f)


def build_prompt(template: dict, subject_override: dict = None) -> str:
    pt = template["prompt_template"]

    subject = pt["subject"]
    if subject_override:
        subject = {**subject, **subject_override}

    realism = pt["realism_details"]
    lighting = pt["lighting"]
    camera = pt["camera"]
    env = pt["environment"]
    post = pt["post_processing"]
    keywords = pt["quality_keywords"]

    parts = [
        f"Professional RAW photograph, {post['resolution']}, hyperrealistic portrait of",
        f"{subject['description']},",
        f"{subject['body_type']},",
        f"wearing {subject['attire']},",
        f"{subject['hair']},",
        f"{subject['skin']},",
        f"{subject['eyes']},",
        f"{subject['face']},",
        f"{subject['expression']},",
        f"{subject['pose']}.",
        f"{realism['skin_realism']},",
        f"{realism['hair_realism']},",
        f"{realism['body_realism']},",
        f"{realism['fabric_realism']}.",
        f"{lighting['setup']} with {lighting['key_light']},",
        f"{lighting['fill_light']},",
        f"{lighting['rim_light']},",
        f"{lighting['color_temperature']}.",
        f"Shot on {camera['body']} with {camera['lens']} at {camera['aperture']},",
        f"{camera['iso']}, {camera['focus']}, {camera['distance']}.",
        f"{env['background']}.",
        f"{', '.join(keywords[:5])}.",
    ]

    return " ".join(parts)


def build_negative(template: dict) -> str:
    return ", ".join(template["prompt_template"]["negative_prompt"])


def main():
    parser = argparse.ArgumentParser(description="Build image prompt from JSON template")
    parser.add_argument("--template", help="Path to template JSON", default=None)
    parser.add_argument("--subject", help="Path to subject override JSON", default=None)
    parser.add_argument("--negative", action="store_true", help="Also print negative prompt")
    args = parser.parse_args()

    template = load_template(args.template)
    override = load_subject_override(args.subject) if args.subject else None
    prompt = build_prompt(template, override)

    print("=== PROMPT ===")
    print(prompt)
    print()

    if args.negative:
        print("=== NEGATIVE PROMPT ===")
        print(build_negative(template))


if __name__ == "__main__":
    main()
