from datetime import datetime
from typing import Any, Dict, Iterable, Optional, Tuple

import pandas as pd


def _as_year(value: Any) -> Optional[int]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    # Numeric year
    if isinstance(value, (int, float)) and not pd.isna(value):
        year = int(value)
        return year if 1800 <= year <= 2100 else None
    # String year or date
    text = str(value).strip()
    if not text:
        return None
    # Exact 4-digit year
    if text.isdigit() and len(text) == 4:
        year = int(text)
        return year if 1800 <= year <= 2100 else None
    # Try general parse and pick year
    ts = pd.to_datetime(text, errors="coerce", dayfirst=False, utc=False)
    if pd.isna(ts):
        ts = pd.to_datetime(text, errors="coerce", dayfirst=True, utc=False)
    if pd.isna(ts):
        return None
    if isinstance(ts, pd.DatetimeIndex):
        ts = ts[0]
    return int(ts.year)


def _series_to_age_years(series: pd.Series, reference_year: int) -> Iterable[Optional[float]]:
    ages: list[Optional[float]] = []
    for v in series.tolist():
        year = _as_year(v)
        if year is None:
            ages.append(None)
        else:
            age = reference_year - year
            ages.append(float(age) if age >= 0 else None)
    return ages


def age_difference_results(
    mentees_df: pd.DataFrame,
    mentors_df: pd.DataFrame,
    importance_modifier: float = 1.0,
    reference_date: Optional[pd.Timestamp] = None,
) -> Dict[Tuple[int, int], float]:
    """
    Normalized minimize score based on absolute age difference where:
    - 1.0 when ages are equal (difference == 0)
    - 0.0 when difference equals the range (max_age - min_age) across both datasets

    If either value is missing/unparseable, score is 0.0.
    """

    mentee_id_col = "Mentee Number"
    mentor_id_col = "Mentor Number"
    mentor_dob_col = "Geburtsdatum / Date of birth"
    mentee_dob_col = "Birthday"

    ref = reference_date or pd.Timestamp(datetime.utcnow().date())
    reference_year = int(ref.year)

    mentee_ages = list(_series_to_age_years(mentees_df[mentee_dob_col], reference_year))
    mentor_ages = list(_series_to_age_years(mentors_df[mentor_dob_col], reference_year))

    all_ages = [a for a in mentee_ages + mentor_ages if a is not None]
    if not all_ages:
        return {}

    min_age = min(all_ages)
    max_age = max(all_ages)
    age_range = max_age - min_age

    results: Dict[Tuple[int, int], float] = {}

    for mentee_idx, mentee_row in mentees_df.iterrows():
        mentee_id = mentee_row[mentee_id_col]
        mentee_age = mentee_ages[mentee_idx]

        for mentor_idx, mentor_row in mentors_df.iterrows():
            mentor_id = mentor_row[mentor_id_col]
            mentor_age = mentor_ages[mentor_idx]

            score = 0.0
            if mentee_age is not None and mentor_age is not None:
                diff = abs(mentee_age - mentor_age)
                if age_range > 0:
                    score = max(0.0, 1.0 - (diff / age_range))
                else:
                    score = 1.0

            results[(mentee_id, mentor_id)] = score * importance_modifier

    return results


