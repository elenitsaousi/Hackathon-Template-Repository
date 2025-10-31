from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
import sys
import pandas as pd
import tempfile
import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Add parent directory to path to import model_dev
sys.path.append(str(Path(__file__).resolve().parent.parent))

from model_dev.main import run_all_categories_with_params, _load_csv
from model_dev.final_match import compute_final_matches_from_data

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

# Validate data directory exists
if not DATA_DIR.exists():
    raise RuntimeError(f"Data directory not found: {DATA_DIR}")

# Validate required CSV files exist
REQUIRED_FILES = [
    "mentor_application.csv",
    "mentor_interview.csv",
    "mentee_application.csv",
    "mentee_interview.csv",
]

for filename in REQUIRED_FILES:
    file_path = DATA_DIR / filename
    if not file_path.exists():
        raise RuntimeError(f"Required CSV file not found: {file_path}")

app = FastAPI(
    title="Mentor-Mentee Matching API",
    description="API for computing mentor-mentee matching scores across multiple categories",
    version="1.0.0",
)

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ImportanceModifiers(BaseModel):
    """Importance modifiers for each matching category"""
    gender: Optional[float] = Field(None, description="Importance modifier for gender matching")
    academia: Optional[float] = Field(None, description="Importance modifier for academia matching")
    languages: Optional[float] = Field(None, description="Importance modifier for language matching")
    age_difference: Optional[float] = Field(None, description="Importance modifier for age difference")
    geographic_proximity: Optional[float] = Field(None, description="Importance modifier for geographic proximity")


class MatchingRequest(BaseModel):
    """Request model for matching endpoint"""
    mentees_application_csv: Optional[str] = Field(
        None,
        description="Path to mentees application CSV file (relative to data directory or absolute path). "
                    "Defaults to 'mentee_application.csv'"
    )
    mentees_interview_csv: Optional[str] = Field(
        None,
        description="Path to mentees interview CSV file (relative to data directory or absolute path). "
                    "Defaults to 'mentee_interview.csv'"
    )
    mentors_application_csv: Optional[str] = Field(
        None,
        description="Path to mentors application CSV file (relative to data directory or absolute path). "
                    "Defaults to 'mentor_application.csv'"
    )
    mentors_interview_csv: Optional[str] = Field(
        None,
        description="Path to mentors interview CSV file (relative to data directory or absolute path). "
                    "Defaults to 'mentor_interview.csv'"
    )
    importance_modifiers: Optional[ImportanceModifiers] = Field(
        None,
        description="Optional importance modifiers for each category. Defaults to 1.0 for all categories."
    )
    age_max_difference: Optional[int] = Field(
        None,
        description="Maximum allowed age difference in years. Pairs exceeding this will receive -inf score. "
                    "Defaults to 30 if not provided."
    )
    geographic_max_distance: Optional[int] = Field(
        None,
        description="Maximum allowed geographic distance in km. Pairs exceeding this will receive -inf score. "
                    "Defaults to 200 if not provided."
    )
    manual_matches: Optional[List[str]] = Field(
        None,
        description="List of mentor-mentee pairs to force as matches (format: 'mentor_id-mentee_id'). "
                    "These pairs will override final_match results with +inf score."
    )
    manual_non_matches: Optional[List[str]] = Field(
        None,
        description="List of mentor-mentee pairs to force as non-matches (format: 'mentor_id-mentee_id'). "
                    "These pairs will override final_match results with -inf score and be excluded."
    )


def _convert_tuple_keys_to_strings(results: Dict[Any, Any]) -> Dict[str, Any]:
    """Convert tuple keys (m, n) to string format 'm-n' for JSON serialization"""
    converted = {}
    for key, value in results.items():
        if isinstance(key, tuple) and len(key) == 2:
            converted[f"{key[0]}-{key[1]}"] = value
        else:
            converted[str(key)] = value
    return converted


def _resolve_path(csv_path: Optional[str], default_filename: str) -> Path:
    """Resolve CSV path, handling relative and absolute paths"""
    if csv_path:
        path = Path(csv_path)
        if not path.is_absolute():
            path = DATA_DIR / csv_path
        return path
    return DATA_DIR / default_filename


def _merge_application_and_interview(
    application_df: pd.DataFrame,
    interview_df: pd.DataFrame,
    id_column: str,
) -> pd.DataFrame:
    """
    Merge application and interview dataframes on the ID column.
    
    Args:
        application_df: DataFrame from application CSV
        interview_df: DataFrame from interview CSV
        id_column: Column name to merge on (e.g., "Mentee Number" or "Mentor Number")
    
    Returns:
        Merged DataFrame with combined columns from both dataframes
    """
    if id_column not in application_df.columns:
        raise ValueError(f"ID column '{id_column}' not found in application data")
    if id_column not in interview_df.columns:
        raise ValueError(f"ID column '{id_column}' not found in interview data")
    
    # Merge on ID column, keeping all columns from both dataframes
    # Use outer join to keep all records, or inner join if we want only matches
    merged = pd.merge(
        application_df,
        interview_df,
        on=id_column,
        how="outer",
        suffixes=("", "_interview")
    )
    
    return merged


def _create_merged_csvs(
    mentees_app_path: Path,
    mentees_int_path: Path,
    mentors_app_path: Path,
    mentors_int_path: Path,
) -> Tuple[Path, Path]:
    """
    Load and merge application and interview CSVs for both mentees and mentors.
    Returns paths to temporary merged CSV files.
    
    Returns:
        Tuple of (merged_mentees_path, merged_mentors_path)
    """
    # Load all CSVs
    mentees_app_df = _load_csv(mentees_app_path)
    mentees_int_df = _load_csv(mentees_int_path)
    mentors_app_df = _load_csv(mentors_app_path)
    mentors_int_df = _load_csv(mentors_int_path)
    
    # Merge mentees application + interview
    merged_mentees = _merge_application_and_interview(
        mentees_app_df,
        mentees_int_df,
        "Mentee Number"
    )
    
    # Merge mentors application + interview
    merged_mentors = _merge_application_and_interview(
        mentors_app_df,
        mentors_int_df,
        "Mentor Number"
    )
    
    # Create temporary files for merged data
    temp_dir = tempfile.gettempdir()
    mentees_temp = Path(temp_dir) / f"merged_mentees_{os.getpid()}.csv"
    mentors_temp = Path(temp_dir) / f"merged_mentors_{os.getpid()}.csv"
    
    merged_mentees.to_csv(mentees_temp, index=False)
    merged_mentors.to_csv(mentors_temp, index=False)
    
    return mentees_temp, mentors_temp


@app.get("/")
async def root():
    """Root endpoint providing API information"""
    return {
        "message": "Mentor-Mentee Matching API",
        "version": "1.0.0",
        "endpoints": {
            "/matching": "POST - Compute matching scores with optional parameters",
            "/health": "GET - Health check endpoint",
            "/demo-csv?filename={filename}": "GET - Serve CSV files from data directory for demo purposes"
        }
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.get("/demo-csv")
async def get_demo_csv(filename: str = Query(..., description="Name of the CSV file in the data directory")):
    """
    Serve CSV files from the data directory for demo purposes.
    All 4 files are required:
    - mentor_application.csv
    - mentor_interview.csv
    - mentee_application.csv
    - mentee_interview.csv
    
    Args:
        filename: Name of the CSV file in the data directory (URL encoded if contains spaces)
                  FastAPI automatically decodes URL-encoded values, so spaces are handled correctly
    
    Returns:
        CSV file content as text/csv
    """
    try:
        # FastAPI Query automatically decodes URL-encoded values
        # filename is already decoded by FastAPI (spaces, special chars handled)
        
        # Validate filename is not empty
        if not filename or not filename.strip():
            raise HTTPException(status_code=400, detail="Filename cannot be empty")
        
        # Strip leading/trailing whitespace but preserve spaces in the middle
        filename = filename.strip()
        
        # Security: Only allow CSV files from data directory
        if not filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only CSV files are allowed")
        
        # Prevent path traversal - check for dangerous patterns
        # Allow spaces and normal characters, but not path separators
        if '..' in filename:
            raise HTTPException(status_code=400, detail="Invalid filename: path traversal not allowed")
        
        # Check for path separators (but allow spaces in filenames)
        normalized = filename.replace(' ', '')  # Remove spaces temporarily for check
        if '/' in normalized or '\\' in normalized:
            raise HTTPException(status_code=400, detail="Invalid filename: path separators not allowed")
        
        # Construct file path using pathlib (handles spaces correctly)
        file_path = DATA_DIR / filename
        
        # Ensure file is within data directory (prevent path traversal)
        try:
            resolved_path = file_path.resolve()
            resolved_data_dir = DATA_DIR.resolve()
            # This will raise ValueError if file_path is not within DATA_DIR
            resolved_path.relative_to(resolved_data_dir)
        except ValueError:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file path: file must be in data directory. Attempted path: {file_path}"
            )
        
        # Check if file exists (pathlib handles spaces correctly)
        if not file_path.exists():
            available_files = [f.name for f in DATA_DIR.glob('*.csv')]
            raise HTTPException(
                status_code=404, 
                detail=f"File not found: '{filename}' in {DATA_DIR}. "
                       f"Available files: {', '.join(available_files) if available_files else 'none'}"
            )
        
        # Read and return CSV content
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        from fastapi.responses import Response
        return Response(content=content, media_type="text/csv")
    
    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")


@app.post("/matching")
async def compute_matching(request: MatchingRequest) -> Dict[str, Any]:
    """
    Compute mentor-mentee matching scores across all categories.
    
    This endpoint accepts optional parameters for:
    - Data file paths (4 CSV files: mentees application, mentees interview, 
                       mentors application, mentors interview)
    - Importance modifiers for each category
    - Maximum age difference (pairs exceeding this receive -inf score)
    - Maximum geographic distance (pairs exceeding this receive -inf score)
    
    The application and interview CSVs are automatically merged on their ID columns
    (Mentee Number / Mentor Number) before running the matching algorithm.
    
    Returns a dictionary with matching results for:
    - gender
    - academia
    - languages
    - age_difference
    - geographic_proximity
    - final_matches: List of final matched pairs with scores
    
    Each category's results are formatted with string keys (e.g., "0-1") instead of tuple keys
    for JSON compatibility.
    """
    mentees_temp = None
    mentors_temp = None
    
    try:
        # Resolve all file paths
        mentees_app_path = _resolve_path(
            request.mentees_application_csv,
            "mentee_application.csv"
        )
        mentees_int_path = _resolve_path(
            request.mentees_interview_csv,
            "mentee_interview.csv"
        )
        mentors_app_path = _resolve_path(
            request.mentors_application_csv,
            "mentor_application.csv"
        )
        mentors_int_path = _resolve_path(
            request.mentors_interview_csv,
            "mentor_interview.csv"
        )
        
        # Verify all files exist
        for path, name in [
            (mentees_app_path, "mentees_application_csv"),
            (mentees_int_path, "mentees_interview_csv"),
            (mentors_app_path, "mentors_application_csv"),
            (mentors_int_path, "mentors_interview_csv"),
        ]:
            if not path.exists():
                raise FileNotFoundError(f"CSV file not found: {path} ({name})")
        
        # Merge application and interview data
        mentees_temp, mentors_temp = _create_merged_csvs(
            mentees_app_path,
            mentees_int_path,
            mentors_app_path,
            mentors_int_path,
        )
        
        # Prepare importance modifiers
        importance_modifiers = None
        if request.importance_modifiers:
            # Filter out None values and convert to dict
            modifiers_dict = request.importance_modifiers.model_dump(exclude_none=True)
            if modifiers_dict:
                importance_modifiers = modifiers_dict
        
        # Get age_max_difference and geographic_max_distance (use defaults if None)
        age_max_diff = request.age_max_difference if request.age_max_difference is not None else 30
        geo_max_dist = request.geographic_max_distance if request.geographic_max_distance is not None else 200
        
        # Run matching with merged CSVs
        results = run_all_categories_with_params(
            mentees_csv=mentees_temp,
            mentors_csv=mentors_temp,
            importance_modifiers=importance_modifiers,
            age_max_difference=age_max_diff,
            geographic_max_distance=geo_max_dist,
        )
        
        # Parse manual matches and non-matches from request
        manual_matches = request.manual_matches or []
        manual_non_matches = request.manual_non_matches or []
        
        # Compute final matches from the category results
        final_matches = compute_final_matches_from_data(
            results,
            manual_matches=manual_matches,
            manual_non_matches=manual_non_matches
        )
        
        # Convert tuple keys to strings for JSON serialization
        converted_results = {}
        for category, category_results in results.items():
            converted_results[category] = _convert_tuple_keys_to_strings(category_results)
        
        # Add final matches to the response
        converted_results["final_matches"] = final_matches
        
        # FastAPI's JSONResponse handles inf/-inf by converting to "Infinity"/"-Infinity" strings
        # This is standard JSON behavior and the frontend can handle these string values
        return converted_results
    
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        # Clean up temporary files
        if mentees_temp and mentees_temp.exists():
            try:
                mentees_temp.unlink()
            except Exception:
                pass
        if mentors_temp and mentors_temp.exists():
            try:
                mentors_temp.unlink()
            except Exception:
                pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

