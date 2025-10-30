import json
from pathlib import Path
from typing import Any, Dict
try:
    from model_dev.categories import gender
except ModuleNotFoundError:
    # Allow running this file directly: python model_dev/main.py
    import sys
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    from model_dev.categories import gender
import pandas as pd


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
    mentees_df = _load_csv(Path(mentees_csv))
    mentors_df = _load_csv(Path(mentors_csv))
    
    print(mentees_df.columns)
    print(mentors_df.columns)
    print(mentees_df["Gender"].head(2))
    print(mentors_df["Geschlecht / Gender"].head(2))
    
    # Importance modifiers
    importance_modifiers = {
        "gender": 1.0,
    }

    # Output formats Dict[Tuple[int, int], float] - (mentee_id, mentor_id) -> score

    # Gender
    gender_results = gender.gender_results(mentees_df=mentees_df, mentors_df=mentors_df, importance_modifier=importance_modifiers["gender"])

    return {"gender": gender_results}


if __name__ == "__main__":
    output = run_all_categories()
    print(output)


