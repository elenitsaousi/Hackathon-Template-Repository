from typing import Any, Dict, Tuple
import pandas as pd
from sentence_transformers import SentenceTransformer, util
import torch
import re


# -------------------------------
# Helper: Extract study level
# -------------------------------
LEVEL_MAP = {
    "high school": (0, "High School"),
    "gymnasium": (0, "High School"),
    "other": (0.5, "Other"),
    "bachelor": (1.0, "Bachelor"),
    "undergraduate": (1.0, "Bachelor"),
    "master": (2.0, "Master"),
    "msc": (2.0, "Master"),
    "phd": (3.0, "PhD"),
    "doctorate": (3.0, "PhD"),
    "doctoral": (3.0, "PhD"),
    "professor": (4.0, "Professor"),
}


def extract_study_level(text: str) -> Tuple[float, str]:
    """Return numeric and label level from free text."""
    if not isinstance(text, str):
        return 0.0, ""
    t = text.lower()
    for k, (v, label) in LEVEL_MAP.items():
        if k in t:
            return v, label
    return 0.0, ""


# -------------------------------
# Extract academic field keywords
# -------------------------------
def extract_field_keywords(text: str) -> str:
    """Extract key academic terms."""
    if not isinstance(text, str) or not text.strip():
        return ""
    parts = re.split(r"[.,;]|und|and|also|ausserdem|auch", text, flags=re.IGNORECASE)
    candidates = []
    for p in parts:
        p = p.strip()
        field_match = re.findall(
            r"[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-]+(?:\s*[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-]+)*", p
        )
        for match in field_match:
            if len(match) > 3 and any(
                kw in match.lower()
                for kw in [
                    "wissenschaft", "wesen", "econom", "science",
                    "engineering", "informatics", "law", "business",
                    "pädagog", "medizin", "bio", "chemie"
                ]
            ):
                candidates.append(match)
    if not candidates:
        fallback = [w for w in re.findall(r"[A-ZÄÖÜ][a-zäöüß\-]+", text) if len(w) > 3]
        candidates.extend(fallback)
    clean_fields = list(dict.fromkeys(candidates))
    return ", ".join(clean_fields)


def has_swiss_experience(text: str) -> str:
    """Return 'yes' if the mentor clearly has experience or confidence in the Swiss university system."""
    if not isinstance(text, str) or not text.strip():
        return "no"

    # normalize lightly (διατηρεί σημεία στίξης όπως . , για να μην εξαφανίζεται το "Yes.")
    t = text.lower().strip()

    # --- Positive clues (broader list) ---
    positives = [
        # direct affirmations
        "yes", "confident", "familiar", "experienced", "very experienced",
        # Swiss context
        "swiss", "switzerland", "zurich", "obwalden", "eth", "ethz", "uzh",
        "hochschule", "applied sciences", "fh", "zhaw", "bfh", "hslu", "fhnw",
        "university of zurich", "studying in zurich", "study in switzerland",
        # education-related
        "gone through", "application process", "knows universities",
        "knows what is out there", "has contacts", "knows the system",
        "understand the swiss system", "education system", "studied in switzerland",
        "grew up", "migration background", "familiar experience",
        "understands the studies level", "been leading", "registered", "studying myself"
    ]

    # --- Negative or uncertain clues ---
    negatives = [
        "no", "not sure", "unsure", "would need to find out", "does not know",
        "don't know", "doesn't know", "no experience", "not familiar", "unfamiliar",
        "have to find out", "need to learn", "need to find out"
    ]

    # --- Direct negation check first ---
    if any(re.search(rf"\b{kw}\b", t) for kw in negatives):
        return "no"

    # --- Check positive patterns ---
    if any(re.search(rf"\b{kw}\b", t) for kw in positives):
        return "yes"

    # --- fallback heuristic (first word or general vibe) ---
    if re.match(r"^\s*yes\b", t) or "confident" in t or "experienced" in t:
        return "yes"

    return "no"




# -------------------------------
# Mentee uncertainty → yes/no
# -------------------------------
def has_uncertainty(text: str) -> str:
    """Detect if the mentee expresses need for mentor support (yes/no)."""
    if not isinstance(text, str) or not text.strip():
        return "no"

    # Normalize text
    t = re.sub(r"[^a-zA-ZäöüÄÖÜß\s]", " ", text.lower().strip())
    t = re.sub(r"\s+", " ", t)

    # Negative patterns → clearly no need
    neg_patterns = [
        "no", "very well informed", "already has support",
        "does not need", "has enough support", "no mentor needed",
        "no need for support"
    ]
    if any(p in t for p in neg_patterns):
        return "no"

    # Positive patterns → clear uncertainty / need
    pos_patterns = [
        "need", "help", "support", "mentor", "guidance",
        "figure out", "confused", "unsure", "find a way",
        "understand", "learn about", "advice", "consulting",
        "would be helpful", "it would be helpful", "would support",
        "would like a mentor", "find direction", "get information",
        "requirements", "language course", "application", "study subject",
        "decide", "choosing study", "understand education system", "find opportunities"
    ]
    if any(p in t for p in pos_patterns):
        return "yes"

    return "no"



# -------------------------------
# Text builders
# -------------------------------
def build_mentee_desired(row: pd.Series) -> str:
    combined = " ".join(
        [
            str(row.get("Desired Studies", "")),
            str(
                row.get(
                    "Do you know if you want to study, and if yes, why? Do you know what you want to study, and if yes, what and why?",
                    "",
                )
            ),
        ]
    )
    return extract_field_keywords(combined)


def build_mentee_background(row: pd.Series) -> str:
    combined = " ".join(
        [
            str(row.get("Previous studies (level)", "")),
            str(row.get("Name and country of last degree", "")),
        ]
    )
    return extract_field_keywords(combined)


def build_mentor_field(row: pd.Series) -> str:
    return extract_field_keywords(
        str(
            row.get(
                "Aktueller oder zuletzt abgeschlossener Studiengang / Current or most recently completed course of study",
                "",
            )
        )
    )


# -------------------------------
# Main Function
# -------------------------------
def academia_results(
    mentees_df: pd.DataFrame,
    mentors_df: pd.DataFrame,
    importance_modifier: float = 1.0,
) -> Dict[str, Any]:
    """Compute academic alignment and mentoring synergy (yes/no)."""
    model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

    mentee_desired = [build_mentee_desired(row) for _, row in mentees_df.iterrows()]
    mentee_background = [build_mentee_background(row) for _, row in mentees_df.iterrows()]
    mentor_fields = [build_mentor_field(row) for _, row in mentors_df.iterrows()]

    mentor_emb = model.encode(mentor_fields, convert_to_tensor=True, normalize_embeddings=True)
    mentee_desired_emb = model.encode(mentee_desired, convert_to_tensor=True, normalize_embeddings=True)
    mentee_background_emb = model.encode(mentee_background, convert_to_tensor=True, normalize_embeddings=True)

    sim_desired = util.cos_sim(mentee_desired_emb, mentor_emb)
    sim_background = util.cos_sim(mentee_background_emb, mentor_emb)

    results = {}

    for i, mentee_row in mentees_df.iterrows():
        mentee_id = str(mentee_row["Mentee Number"])

        mentee_level_num, mentee_level_label = extract_study_level(
            str(mentee_row.get("Previous studies (level)", "")) + " " +
            str(mentee_row.get("Desired Studies", ""))
        )

        # detect mentee uncertainty
        mentee_uncertainty = has_uncertainty(
            str(
                mentee_row.get("6. Do you need the support of a mentor? \nIf yes, please give examples of how your mentor can support you",
               mentee_row.get("6. Do you need the support of a mentor? If yes, please give examples of how your mentor can support you", ""))
           )

        )

        for j, mentor_row in mentors_df.iterrows():
            mentor_id = str(mentor_row["Mentor Number"])
            mentor_level_num, mentor_level_label = extract_study_level(
                str(
                    mentor_row.get(
                        "Aktuelle oder zuletzt abgeschlossene Studienstufe / Current or most recently completed level of study",
                        "",
                    )
                )
            )

            # detect mentor Swiss experience
            # 🔍 dynamically find the right column containing "confident" and "swiss"
            mentor_answer = ""
            for col in mentors_df.columns:
                if "confident" in col.lower() and "swiss" in col.lower():
                    mentor_answer = mentor_row.get(col, "")
                    break

            mentor_experience = has_swiss_experience(str(mentor_answer))





            # base cosine similarities
            desired_score = float(sim_desired[i][j].item())
            background_score = float(sim_background[i][j].item())

            # level alignment
            if mentor_level_num >= mentee_level_num:
                level_score = 1.0
                penalty = 0.0
            elif mentee_level_num > 0:
                level_score = mentor_level_num / mentee_level_num
                penalty = (mentee_level_num - mentor_level_num) * 0.1
            else:
                level_score = 0.0
                penalty = 0.0

            # apply bonus only if both = yes
            guidance_bonus = 0.1 if (mentee_uncertainty == "yes" and mentor_experience == "yes") else 0.0

            final_score = (
                0.55 * desired_score +
                0.15 * background_score +
                0.25 * level_score -
                penalty +
                guidance_bonus
            )
            final_score = max(0.0, min(1.0, final_score * importance_modifier))

            # save structured result
            results[f"{mentee_id}-{mentor_id}"] = {
                "academic_score": round(final_score, 3),
                "mentee_academics": {
                    "desired_field": mentee_desired[i],
                    "background_field": mentee_background[i],
                    "level": mentee_level_label or "Unknown",
                },
                "mentor_academics": {
                    "field": mentor_fields[j],
                    "level": mentor_level_label or "Unknown",
                },
                "mentoring_synergy": {
                    "mentee_uncertainty": mentee_uncertainty,
                    "mentor_swiss_experience": mentor_experience,
                    "bonus_applied": "yes" if guidance_bonus > 0 else "no",
                },
            }

    print(" Academia matching complete (yes/no synergy mode).")
    yes_uncertainty = sum(1 for _, row in mentees_df.iterrows()
                      if has_uncertainty(str(row.get("6. Do you need the support of a mentor? If yes, please give examples of how your mentor can support you", ""))) == "yes")
    yes_experience = sum(1 for _, row in mentors_df.iterrows()
                        if has_swiss_experience(str(row.get("Do you feel confident in navigating the Swiss university system?", ""))) == "yes")

    print(f" Mentees needing support (yes): {yes_uncertainty}/{len(mentees_df)}")
    print(f" Mentors with Swiss experience (yes): {yes_experience}/{len(mentors_df)}")

    yes_experience = sum(
        1 for _, row in mentors_df.iterrows()
        if has_swiss_experience(
            str(
                row.get("2. Do you feel confident in navigating the Swiss university system? ",
                    row.get("Do you feel confident in navigating the Swiss university system?", ""))
            )
        ) == "yes"
    )
    print(f"🔎 Mentors with Swiss experience (yes): {yes_experience}/{len(mentors_df)}")



    return results
