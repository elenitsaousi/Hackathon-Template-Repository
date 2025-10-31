from pathlib import Path
from typing import Any, Dict, Optional
import pandas as pd
import json
import sys

# ------------------------------------
# Imports
# ------------------------------------
try:
    from model_dev.categories import (
        gender,
        academia,
        languages,
        age_difference,
        geographic_proximity,
    )
except ModuleNotFoundError:
    sys.path.append(str(Path(__file__).resolve().parent.parent))
<<<<<<< HEAD
    from model_dev.categories import (
        gender,
        academia,
        languages,
        age_difference,
        geographic_proximity,
    )
=======
    from model_dev.categories import gender, academia, languages, age_difference, geographic_proximity
>>>>>>> 12a0c3059d45c3556a79138f2cda3caf8ee6e6c8


# ------------------------------------
# Base Directories
# ------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


# ------------------------------------
# Helper to load CSVs
# ------------------------------------
def _load_csv(csv_path: Path) -> pd.DataFrame:
    """Safely load a CSV file."""
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")
    return pd.read_csv(csv_path)


# ------------------------------------
# Merge application + interview data
# ------------------------------------
def merge_datasets(app_df: pd.DataFrame, interview_df: pd.DataFrame, id_col: str) -> pd.DataFrame:
    """Merge two datasets (application + interview) on the given ID column."""
    merged = pd.merge(app_df, interview_df, on=id_col, how="outer", suffixes=("_app", "_int"))
    print(f"✅ Merged {len(app_df)} application + {len(interview_df)} interview entries → {len(merged)} total ({id_col})")
    return merged


# ------------------------------------
# Main Runner
# ------------------------------------
def run_all_categories(
    mentee_app_csv: Path = DATA_DIR / "GaaP Data - Backup - Mentee Application.csv",
    mentee_int_csv: Path = DATA_DIR / "GaaP Data - Backup - Mentee Interview.csv",
    mentor_app_csv: Path = DATA_DIR / "GaaP Data - Backup - Mentors Application.csv",
    mentor_int_csv: Path = DATA_DIR / "GaaP Data - Backup - Mentors Interview.csv",
) -> Dict[str, Any]:
    """Run all categories: gender, academia, languages, age difference, and proximity."""

    # ------------------ Load all CSVs ------------------
    mentee_app = _load_csv(mentee_app_csv)
    mentee_int = _load_csv(mentee_int_csv)
    mentor_app = _load_csv(mentor_app_csv)
    mentor_int = _load_csv(mentor_int_csv)

    # ------------------ Merge application + interview ------------------
    mentees_df = merge_datasets(mentee_app, mentee_int, id_col="Mentee Number")
    mentors_df = merge_datasets(mentor_app, mentor_int, id_col="Mentor Number")

    # Normalize column names (remove hidden whitespace/newlines)
    mentees_df.columns = mentees_df.columns.str.strip().str.replace(r"\s+", " ", regex=True)
    mentors_df.columns = mentors_df.columns.str.strip().str.replace(r"\s+", " ", regex=True)

    print("✅ All datasets loaded & merged successfully.")
    print(f"Mentees: {len(mentees_df)} | Mentors: {len(mentors_df)}\n")

    # ------------------ Importance Modifiers ------------------
    importance_modifiers = {
        "gender": 1.0,
        "academia": 1.0,
        "languages": 1.0,
        "age_difference": 1.0,
        "geographic_proximity": 1.0,
    }

    # ------------------ Category 1: Gender ------------------
    print("⚙️ Running Gender Matching...")
    gender_results = gender.gender_results(
        mentees_df=mentees_df,
        mentors_df=mentors_df,
        importance_modifier=importance_modifiers["gender"],
    )

    # ------------------ Category 2: Academia ------------------
    print("⚙️ Running Academia Matching...")
    academia_results_data = academia.academia_results(
        mentees_df=mentees_df,
        mentors_df=mentors_df,
        importance_modifier=importance_modifiers["academia"],
    )

    # ------------------ Category 3: Languages ------------------
    print("⚙️ Running Language Matching...")
    languages_results = languages.languages_results(
        mentees_df=mentees_df,
        mentors_df=mentors_df,
        importance_modifier=importance_modifiers["languages"],
    )

    # ------------------ Category 4: Age Difference ------------------
    print("⚙️ Running Age Difference Matching...")
    age_results = age_difference.age_difference_results(
        mentees_df=mentees_df,
        mentors_df=mentors_df,
        importance_modifier=importance_modifiers["age_difference"],
    )

    # ------------------ Category 5: Geographic Proximity ------------------
    print("⚙️ Running Geographic Proximity Matching...")
    geo_results = geographic_proximity.geographic_proximity_results(
        mentees_df=mentees_df,
        mentors_df=mentors_df,
        importance_modifier=importance_modifiers["geographic_proximity"],
    )

    print("\n✅ All matching categories completed successfully.\n")

    return {
        "gender": gender_results,
        "academia": academia_results_data,
        "languages": languages_results,
        "age_difference": age_results,
        "geographic_proximity": geo_results,
    }


<<<<<<< HEAD
# ------------------------------------
# Save Results
# ------------------------------------
=======
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


>>>>>>> 12a0c3059d45c3556a79138f2cda3caf8ee6e6c8
if __name__ == "__main__":
    output = run_all_categories()

    # ------------------ Convert tuple keys (m, n) → "m-n" for JSON ------------------
    for category, results in output.items():
        converted = {}
        for k, v in results.items():
            # If key is a tuple like (mentee_id, mentor_id)
            if isinstance(k, tuple) and len(k) == 2:
                m, n = k
                converted[f"{m}-{n}"] = v
            else:
                # Key already a string or unexpected format
                converted[str(k)] = v
        output[category] = converted


    # ------------------ Save JSONs ------------------
    files_to_save = {
        "gender": "results_gender.json",
        "academia": "results_academia.json",
        "languages": "results_languages.json",
        "age_difference": "results_age_difference.json",
        "geographic_proximity": "results_geographic_proximity.json",
    }
    

    for category, filename in files_to_save.items():
        out_path = BASE_DIR / filename
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({category: output[category]}, f, indent=2, ensure_ascii=False)
        print(f"💾 Saved {category} results → {filename}")

    print("\n🎯 All results successfully exported.\n")

    

