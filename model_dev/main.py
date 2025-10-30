import json
from pathlib import Path
from typing import Any, Dict
import pandas as pd

try:
    from model_dev.categories import gender, academia, languages
except ModuleNotFoundError:
    # Allow running this file directly: python model_dev/main.py
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    from model_dev.categories import gender, academia, languages


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CATEGORIES_DIR = Path(__file__).resolve().parent / "categories"


def _load_csv(csv_path: Path) -> pd.DataFrame:
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")
    # Allow multiline fields and keep default encoding; pandas will infer best possible
    return pd.read_csv(csv_path)


def run_all_categories(
    mentees_csv: Path = DATA_DIR / "GaaP Data - Backup - Mentee Application.csv",
    mentors_csv: Path = DATA_DIR / "GaaP Data - Backup - Mentors Application.csv",
) -> Dict[str, Any]:
    """Run gender, academia, and language matchings"""
    mentees_df = _load_csv(Path(mentees_csv))
    mentors_df = _load_csv(Path(mentors_csv))

    print(mentees_df.columns)
    print(mentors_df.columns)
    print(mentees_df["Gender"].head(2))
    print(mentors_df["Geschlecht / Gender"].head(2))

    # Importance modifiers
    importance_modifiers = {
        "gender": 1.0,
        "academia": 1.0,
        "languages": 1.0,
    }

    # --- Category 1: Gender ---
    gender_results = gender.gender_results(
        mentees_df=mentees_df,
        mentors_df=mentors_df,
        importance_modifier=importance_modifiers["gender"],
    )

    # --- Category 2: Academia ---
    academia_results = academia.academia_results(
        mentees_df=mentees_df,
        mentors_df=mentors_df,
        importance_modifier=importance_modifiers["academia"],
    )

    # --- Category 3: Languages ---
    languages_results = languages.languages_results(
        mentees_df=mentees_df,
        mentors_df=mentors_df,
        importance_modifier=importance_modifiers["languages"],
    )

    return {
        "gender": gender_results,
        "academia": academia_results,
        "languages": languages_results,
    }


if __name__ == "__main__":
    output = run_all_categories()
    print("✅ Matching completed")

    # Convert tuple keys (m, n) → "m-n" for JSON
    for category, results in output.items():
        output[category] = {f"{m}-{n}": score for (m, n), score in results.items()}

    # --- Save gender results ---
    with open(BASE_DIR / "results_gender.json", "w") as f:
        json.dump({"gender": output["gender"]}, f, indent=2)
    print("💾 Saved gender results to results_gender.json")

    # --- Save academia results ---
    with open(BASE_DIR / "results_academia.json", "w") as f:
        json.dump({"academia": output["academia"]}, f, indent=2)
    print("💾 Saved academia results to results_academia.json")

    # --- Save languages results ---
    with open(BASE_DIR / "results_languages.json", "w") as f:
        json.dump({"languages": output["languages"]}, f, indent=2)
    print("💾 Saved languages results to results_languages.json")
