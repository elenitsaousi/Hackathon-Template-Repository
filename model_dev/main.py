from pathlib import Path
from typing import Any, Dict, Optional, Union, BinaryIO, TextIO
import pandas as pd
import json
import sys
import io

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
    from model_dev.categories import (
        gender,
        academia,
        languages,
        age_difference,
        geographic_proximity,
    )


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


def _load_csv_from_data(csv_data: Union[pd.DataFrame, BinaryIO, TextIO, bytes, str, Path]) -> pd.DataFrame:
    """
    Load CSV data from various input types.
    
    Args:
        csv_data: Can be:
            - A pandas DataFrame (already loaded) - returned as-is
            - A file-like object (BytesIO, TextIOWrapper, etc.) - read via pd.read_csv()
            - bytes - converted to BytesIO and read
            - str - treated as file path or CSV content
            - Path - treated as file path
    
    Returns:
        pandas DataFrame
    """
    # If already a DataFrame, return as-is
    if isinstance(csv_data, pd.DataFrame):
        return csv_data
    
    # If it's a Path, use the existing _load_csv function
    if isinstance(csv_data, Path):
        return _load_csv(csv_data)
    
    # If it's a string, check if it's a file path or CSV content
    if isinstance(csv_data, str):
        # Try as file path first
        path = Path(csv_data)
        if path.exists():
            return pd.read_csv(path)
        # Otherwise treat as CSV content
        return pd.read_csv(io.StringIO(csv_data))
    
    # If it's bytes, convert to BytesIO
    if isinstance(csv_data, bytes):
        return pd.read_csv(io.BytesIO(csv_data))
    
    # For file-like objects (IO streams, BytesIO, etc.), read directly
    # Reset position to start in case it was already read
    try:
        csv_data.seek(0)
    except (AttributeError, OSError):
        pass  # Some objects don't support seek
    
    return pd.read_csv(csv_data)


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
    age_max_difference: Optional[int] = 30,
    geographic_max_distance: Optional[int] = 200,
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
        age_max_difference=age_max_difference,
    )

    # ------------------ Category 5: Geographic Proximity ------------------
    print("⚙️ Running Geographic Proximity Matching...")
    geo_results = geographic_proximity.geographic_proximity_results(
        mentees_df=mentees_df,
        mentors_df=mentors_df,
        importance_modifier=importance_modifiers["geographic_proximity"],
        geographic_max_distance=geographic_max_distance,
    )

    print("\n✅ All matching categories completed successfully.\n")

    return {
        "gender": gender_results,
        "academia": academia_results_data,
        "languages": languages_results,
        "age_difference": age_results,
        "geographic_proximity": geo_results,
    }


# ------------------------------------
# Function to accept CSV data directly (for backend use)
# ------------------------------------
def run_all_categories_from_data(
    mentee_app_csv: Union[pd.DataFrame, BinaryIO, TextIO, bytes, str, Path],
    mentee_int_csv: Union[pd.DataFrame, BinaryIO, TextIO, bytes, str, Path],
    mentor_app_csv: Union[pd.DataFrame, BinaryIO, TextIO, bytes, str, Path],
    mentor_int_csv: Union[pd.DataFrame, BinaryIO, TextIO, bytes, str, Path],
    importance_modifiers: Optional[Dict[str, float]] = None,
    age_max_difference: Optional[int] = 30,
    geographic_max_distance: Optional[int] = 200,
) -> Dict[str, Any]:
    """
    Run all matching categories with CSV data passed directly (not file paths).
    
    This function accepts CSV data in various formats, making it suitable for use
    with backend systems that receive file uploads or have data in memory.
    
    Args:
        mentee_app_csv: Mentee application CSV data. Can be:
            - pandas DataFrame (already loaded)
            - file-like object (BytesIO, TextIOWrapper, UploadFile, etc.)
            - bytes (CSV content as bytes)
            - str (CSV content as string or file path)
            - Path (file path)
        mentee_int_csv: Mentee interview CSV data (same types as above)
        mentor_app_csv: Mentor application CSV data (same types as above)
        mentor_int_csv: Mentor interview CSV data (same types as above)
        importance_modifiers: Optional dictionary of importance modifiers for each category.
            Expected keys: "gender", "academia", "languages", "age_difference", "geographic_proximity"
            Defaults to 1.0 for all categories if not provided.
        age_max_difference: Maximum allowed age difference in years. Defaults to 30.
        geographic_max_distance: Maximum allowed geographic distance in km. Defaults to 200.
    
    Returns:
        Dictionary containing results for all categories:
        - gender
        - academia
        - languages
        - age_difference
        - geographic_proximity
    """
    # Load CSV data from various input types
    mentee_app = _load_csv_from_data(mentee_app_csv)
    mentee_int = _load_csv_from_data(mentee_int_csv)
    mentor_app = _load_csv_from_data(mentor_app_csv)
    mentor_int = _load_csv_from_data(mentor_int_csv)
    
    # Merge application + interview data
    mentees_df = merge_datasets(mentee_app, mentee_int, id_col="Mentee Number")
    mentors_df = merge_datasets(mentor_app, mentor_int, id_col="Mentor Number")
    
    # Normalize column names (remove hidden whitespace/newlines)
    mentees_df.columns = mentees_df.columns.str.strip().str.replace(r"\s+", " ", regex=True)
    mentors_df.columns = mentors_df.columns.str.strip().str.replace(r"\s+", " ", regex=True)
    
    print("✅ All datasets loaded & merged successfully.")
    print(f"Mentees: {len(mentees_df)} | Mentors: {len(mentors_df)}\n")
    
    # Prepare importance modifiers (default to 1.0 for all if not provided)
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
        age_max_difference=age_max_difference,
    )

    # ------------------ Category 5: Geographic Proximity ------------------
    print("⚙️ Running Geographic Proximity Matching...")
    geo_results = geographic_proximity.geographic_proximity_results(
        mentees_df=mentees_df,
        mentors_df=mentors_df,
        importance_modifier=importance_modifiers["geographic_proximity"],
        geographic_max_distance=geographic_max_distance,
    )
    
    print("\n✅ All matching categories completed successfully.\n")

    return {
        "gender": gender_results,
        "academia": academia_results_data,
        "languages": languages_results,
        "age_difference": age_results,
        "geographic_proximity": geo_results,
    }


# ------------------------------------
# Save Results
# ------------------------------------
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

    

