from pathlib import Path
from typing import Any, Dict, Optional
import pandas as pd
import json

try:
    from model_dev.categories import gender, academia, languages, age_difference, geographic_proximity
except ModuleNotFoundError:
    # Allow running this file directly: python model_dev/main.py
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    from model_dev.categories import gender, academia, languages, age_difference, geographic_proximity

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

    # Importance modifiers
    importance_modifiers = {
        "gender": 1.0,
        "academia": 1.0,
        "languages": 1.0,
        "age_difference": 1.0,
        "geographic_proximity": 1.0,
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
     # Age Difference (minimize)
    age_results = age_difference.age_difference_results(
        mentees_df=mentees_df,
        mentors_df=mentors_df,
        importance_modifier=importance_modifiers["age_difference"],
    )

    # Geographic Proximity (minimize)
    geo_results = geographic_proximity.geographic_proximity_results(
        mentees_df=mentees_df,
        mentors_df=mentors_df,
        importance_modifier=importance_modifiers["geographic_proximity"],
    )

    return {
        "gender": gender_results,
        "academia": academia_results,
        "languages": languages_results,
        "age_difference": age_results,
        "geographic_proximity": geo_results,
    }


def run_all_categories_with_params(
    mentees_csv: Path,
    mentors_csv: Path,
    importance_modifiers: Optional[Dict[str, float]] = None,
    age_max_difference: Optional[int] = 30,
    geographic_max_distance: Optional[int] = 200,
) -> Dict[str, Any]:
    """
    Run all category matchings with configurable data paths and importance modifiers.
    
    Args:
        mentees_csv: Path to the mentees CSV file
        mentors_csv: Path to the mentors CSV file
        importance_modifiers: Dictionary of importance modifiers for each category.
                             Defaults to 1.0 for all categories if not provided.
                             Expected keys: "gender", "academia", "languages", 
                             "age_difference", "geographic_proximity"
    
    Returns:
        Dictionary containing results for all categories
    """
    mentees_df = _load_csv(Path(mentees_csv))
    mentors_df = _load_csv(Path(mentors_csv))

    print(mentees_df.columns)
    print(mentors_df.columns)

    # Default importance modifiers if not provided
    if importance_modifiers is None:
        importance_modifiers = {
            "gender": 1.0,
            "academia": 1.0,
            "languages": 1.0,
            "age_difference": 1.0,
            "geographic_proximity": 1.0,
        }
    else:
        # Ensure all required categories are present with defaults
        default_modifiers = {
            "gender": 1.0,
            "academia": 1.0,
            "languages": 1.0,
            "age_difference": 1.0,
            "geographic_proximity": 1.0,
        }
        importance_modifiers = {**default_modifiers, **importance_modifiers}

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

    # --- Category 4: Age Difference (minimize) ---
    age_results = age_difference.age_difference_results(
        mentees_df=mentees_df,
        mentors_df=mentors_df,
        importance_modifier=importance_modifiers["age_difference"],
        age_max_difference=age_max_difference,
    )

    # --- Category 5: Geographic Proximity (minimize) ---
    geo_results = geographic_proximity.geographic_proximity_results(
        mentees_df=mentees_df,
        mentors_df=mentors_df,
        importance_modifier=importance_modifiers["geographic_proximity"],
        geographic_max_distance=geographic_max_distance,
    )

    return {
        "gender": gender_results,
        "academia": academia_results,
        "languages": languages_results,
        "age_difference": age_results,
        "geographic_proximity": geo_results,
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

    # --- Save age difference results ---
    with open(BASE_DIR / "results_age_difference.json", "w") as f:
        json.dump({"age_difference": output["age_difference"]}, f, indent=2)
    print("💾 Saved age difference results to results_age_difference.json")

    # --- Save geographic proximity results ---
    with open(BASE_DIR / "results_geographic_proximity.json", "w") as f:
        json.dump({"geographic_proximity": output["geographic_proximity"]}, f, indent=2)
    print("💾 Saved geographic proximity results to results_geographic_proximity.json")