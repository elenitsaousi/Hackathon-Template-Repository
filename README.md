# SEET Match

## Team Members

- **Margareta Karaqi** (20-487-872) - [margareta.karaqi@uzh.ch](mailto:margareta.karaqi@uzh.ch)
- **Patrik Valach** (25-734-765) - [patrik.valach@uzh.ch](mailto:patrik.valach@uzh.ch)
- **Eleni Tsaousi** (24-745-119) - [eleni.tsousi@uzh.ch](mailto:eleni.tsousi@uzh.ch)

## Team Structure & Roles

### Roles During Development

- **Margareta Karaqi** - Product Owner / Scrum Master
  - Project management and time tracking
  - Design Thinking process facilitation
  - Presentation preparation and design
  - User interviews and stakeholder communication

- **Patrik Valach** - Solution Architect
  - System architecture design
  - Pipeline design and implementation
  - Development support and technical guidance
  - Frontent and some Backend support, APIs

- **Eleni Tsaousi** - Developer
  - Algorithm development and implementation
  - Backend implementation
  - Data normalization and processing
  - Debugging and technical implementation

### Report Writing

Margareta served as the primary report writer, maintaining the incident report throughout the hackathon and writing the bulk of the report thanks to her interview role and stakeholder communication responsibilities. However, the workload was split evenly between coding and report writing, with all team members contributing to various sections of the final report.

## Hackathon Challenge

SEET provides invaluable mentoring to help refugees enter higher education in Switzerland. Currently, the process of matching a new mentee with the right volunteer mentor is done manually. This is time-consuming and limits the program's ability to scale. An effective match is critical for success and depends on complex factors like academic goals, field of study, language skills, and personality.

**The Challenge**: Design a system that automates and enhances this matching process. The goal is to create a tool that helps SEET administrators make faster, higher-quality matches between refugee mentees and volunteer mentors, ultimately improving outcomes for the mentees, and making the program more scalable.

**Specific Requirements**:
- Handle multiple matching criteria simultaneously (academic alignment, language compatibility, geographic proximity, age differences, gender preferences), with option to easily addon more
- Provide an intuitive interface for administrators to review and refine matches
- Allow manual overrides while maintaining optimal global matching
- Scale efficiently as the number of mentors and mentees grows


## Our Solution

SEET Match is an intelligent mentor-mentee matching system that automates and optimizes the pairing process. The solution combines data-driven matching algorithms with an intuitive visual interface to help administrators make faster, higher-quality matches.

### Core Idea

The core idea is to transform the manual, time-consuming matching process into an automated, data-driven system that:
1. **Quantifies Compatibility**: Converts qualitative factors (academic goals, language skills, personality fit) into numerical scores across five distinct categories
2. **Optimizes Globally**: Uses bipartite graph matching algorithms to find the optimal overall pairing solution, not just individual best matches
3. **Preserves Human Judgment**: Allows administrators to override algorithmic recommendations while the system automatically adjusts to find alternative optimal pairings
4. **Visualizes Complexity**: Presents all potential connections in an interactive graph, making it easy to explore and understand the matching landscape

This approach ensures that administrators can leverage both algorithmic optimization and human expertise to make the best possible matches.

### Key Features

1. **Multi-Category Scoring System**
   - **Gender Compatibility**: Matches based on gender preferences when specified
   - **Academic Alignment**: Uses sentence transformers for semantic similarity matching on fields of study, considers degree level alignment, and applies guidance bonus when mentees need support and mentors have Swiss experience
   - **Language Skills**: Matches based on CEFR language level compatibility
   - **Age Compatibility**: Accounts for age differences with configurable maximum age difference threshold (default: 30 years)
   - **Geographic Proximity**: Uses precomputed geographic distances with configurable maximum distance threshold (default: 200 km)

2. **Interactive Bipartite Graph Visualization**
   - Visual representation of all mentor-mentee pair connections
   - Color-coded edges: green for manual matches and high scores, purple for recommended pairs (optimal matching), red for low scores (0), non-matches, and blocked pairs
   - Dynamic node positioning: manually matched pairs appear at the top of the graph
   - Click nodes to explore individual mentor/mentee profiles and view connection details
   - Responsive design that adapts to window size

3. **Optimal Matching Algorithm**
   - Greedy maximum-weight bipartite matching algorithm
   - Automatically calculates the optimal pairing solution that maximizes total match scores
   - Recommends optimal pairs while respecting manual overrides
   - Recalculates recommendations when pairs are excluded

4. **Manual Override System**
   - Toggle manual matches on/off for specific pairs
   - Set pairs as "not match" to exclude them from recommendations
   - Manual selections are preserved across matching operations
   - Visual indicators distinguish manual matches (green) from recommendations (purple) and non-matches (red)
   - Automatic hiding of other edges when a node is manually matched

5. **Configurable Matching Parameters**
   - Adjustable importance weights (0-2x) for each matching category
   - Configurable maximum age difference threshold (default: 30 years)
   - Configurable maximum geographic distance threshold (default: 200 km)
   - Parameter change indicator shows when matching needs to be recalculated

6. **Comprehensive Data Display**
   - Detailed mentor and mentee detail panels showing all columns from both application and interview CSVs
   - Individual category score breakdown for selected pairs (gender, academia, languages, age, location)
   - Global score visualization with progress bar
   - Final matches table displaying all 1-to-1 matched pairs with complete scoring breakdown

### How It Works

1. **Data Input**: Upload four CSV files (mentor application, mentor interview, mentee application, mentee interview) or use default demo files from the data directory
2. **Initial Matching**: System automatically loads data and performs initial matching on startup
3. **Scoring**: Calculates compatibility scores across all five matching categories for every mentor-mentee pair
4. **Optimization**: Optimal matching algorithm finds the best global pairing solution that maximizes total scores
5. **Visualization**: Results displayed in interactive bipartite graph where administrators can explore connections
6. **Refinement**: Adjust parameters, set manual overrides, and click "Match" to recalculate with new settings
7. **Review**: View detailed profiles, individual scores, and final matching results in the dashboard

### Demo
<img width="1012" height="278" alt="image" src="https://github.com/user-attachments/assets/ecb7ada4-6a68-4378-863c-c84ae3e90654" />

<img width="1007" height="981" alt="image" src="https://github.com/user-attachments/assets/238b66bf-15c0-47e2-9d6a-d9b8f501b84b" />

<img width="999" height="648" alt="image" src="https://github.com/user-attachments/assets/aeb864f6-e9b3-4237-be39-1e41e0646bc0" />

<img width="804" height="388" alt="image" src="https://github.com/user-attachments/assets/d15ccdad-676c-40be-a755-be20773a6a4e" />




### Tech Stack

#### Frontend
- **React 18.3** - Modern UI framework for building interactive user interfaces
- **TypeScript** - Type-safe development for better code quality and maintainability
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework for rapid UI development
- **Radix UI** - Accessible component primitives for complex UI elements
- **HTML5 Canvas & SVG** - For rendering the interactive bipartite graph visualization

#### Backend
- **FastAPI** - Modern, fast Python web framework for building APIs
- **Python 3.x** - Core programming language
- **Pandas** - Data manipulation and analysis for processing CSV files
- **Sentence Transformers** - Semantic similarity matching for academic field alignment
- **PyTorch** - Deep learning framework (dependency of sentence-transformers)
- **Geopy** - Geographic distance calculations between mentor/mentee locations
- **OpenRouteService** - Advanced routing and geographic services for accurate distance calculations
- **Uvicorn** - ASGI server for running FastAPI applications

#### Matching Algorithms
- **Greedy Maximum-Weight Bipartite Matching** - Optimal pairing algorithm that maximizes total match scores
- **Multi-Criteria Decision Making** - Weighted scoring system across five compatibility dimensions
- **Sentence Transformers** - Semantic similarity matching for academic field alignment (via `sentence-transformers` library)
- **Geographic Distance Calculations** - Precomputed distance calculations using OpenRouteService and Geopy

#### Architecture
- **RESTful API** - Clean separation between frontend and backend via REST endpoints
- **File Upload Support** - Multipart form data handling for CSV file processing
- **Dynamic UI Updates** - UI updates when matching parameters change (requires "Match" button click)
- **CORS-enabled** - Cross-origin resource sharing for frontend-backend communication

---

## Installation & Setup

### Prerequisites

- **Python 3.8+** - For backend and matching algorithms
- **Node.js 18+** - For frontend development
- **npm** or **yarn** - Package manager for frontend dependencies

### Environment Variables

The system requires API keys for geographic distance calculations. Create a `.env` file in the project root directory:

```bash
# OpenRouteService API Key (required for geographic distance calculations)
# Get your free API key at: https://openrouteservice.org/dev/#/signup
OPEN_ROUTE_SERVICE=your_api_key_here

# OpenCage API Key (optional, fallback for geocoding)
# Get your API key at: https://opencagedata.com/api
OPEN_CAGE_DATA=your_api_key_here
```

**Where to Get API Keys**:
- **OpenRouteService**: Sign up for a free account at [https://openrouteservice.org/dev/#/signup](https://openrouteservice.org/dev/#/signup). Free tier includes 2,000 requests/day.
- **OpenCage Data** (optional): Sign up at [https://opencagedata.com/api](https://opencagedata.com/api). Free tier includes 2,500 requests/day.

**Note**: The system uses precomputed distance caching, so API calls are only made once per unique location pair. If you're using demo data, distances may already be cached.

### Backend Setup

1. Navigate to the project root directory
2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

**Additional Dependencies**:
- **Sentence Transformers**: The first run will automatically download the `paraphrase-multilingual-MiniLM-L12-v2` model (~420MB). This is a one-time download.

3. Start the backend server:
```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173` (or the port shown in the terminal)

### Data Files

The system expects four CSV files:
- `GaaP Data - Backup - Mentors Application.csv`
- `GaaP Data - Backup - Mentors Interview.csv`
- `GaaP Data - Backup - Mentee Application.csv`
- `GaaP Data - Backup - Mentee Interview.csv`

These should be placed in the `data/` directory. The system will automatically use these files if no files are uploaded via the UI.

---

## API Documentation

The SEET Match API is a RESTful service built with FastAPI that provides endpoints for computing mentor-mentee matching scores. The API accepts CSV file uploads and returns comprehensive matching results across multiple categories.

### Base URL

```
http://localhost:8000
```

When running locally, the API is available at `http://localhost:8000`. For production deployments, replace with the appropriate base URL.

### Authentication

Currently, the API does not require authentication. In production, consider implementing API key authentication or OAuth2.

### Endpoints

#### 1. Root Endpoint

**GET** `/`

Returns API information and available endpoints.

**Response:**
```json
{
  "message": "Mentor-Mentee Matching API",
  "version": "1.0.0",
  "endpoints": {
    "/matching": "POST - Compute matching scores with optional parameters",
    "/health": "GET - Health check endpoint",
    "/demo-csv?filename={filename}": "GET - Serve CSV files from data directory for demo purposes"
  }
}
```

**Example:**
```bash
curl http://localhost:8000/
```

---

#### 2. Health Check

**GET** `/health`

Simple health check endpoint to verify the API is running.

**Response:**
```json
{
  "status": "healthy"
}
```

**Example:**
```bash
curl http://localhost:8000/health
```

---

#### 3. Get Demo CSV File

**GET** `/demo-csv?filename={filename}`

Retrieves CSV files from the data directory for demo purposes. This endpoint is used by the frontend to load default data files.

**Parameters:**
- `filename` (query, required): Name of the CSV file in the data directory. Must be URL-encoded if it contains spaces.

**Available Files:**
- `GaaP Data - Backup - Mentors Application.csv`
- `GaaP Data - Backup - Mentors Interview.csv`
- `GaaP Data - Backup - Mentee Application.csv`
- `GaaP Data - Backup - Mentee Interview.csv`

**Response:**
- Content-Type: `text/csv`
- Body: CSV file content

**Example:**
```bash
curl "http://localhost:8000/demo-csv?filename=GaaP%20Data%20-%20Backup%20-%20Mentors%20Application.csv"
```

**Error Responses:**
- `400 Bad Request`: Invalid filename or path traversal attempt
- `404 Not Found`: File does not exist in data directory
- `500 Internal Server Error`: Error reading file

---

#### 4. Compute Matching Scores

**POST** `/matching`

The main endpoint for computing mentor-mentee matching scores. Accepts CSV file uploads and optional matching parameters.

**Content-Type:** `multipart/form-data`

**Request Parameters:**

| Parameter                      | Type            | Required  | Description                                                                 |
|--------------------------------|-----------------|-----------|-----------------------------------------------------------------------------|
| `mentor_application_file`      | File            | No*       | CSV file containing mentor application data                                 |
| `mentor_interview_file`        | File            | No*       | CSV file containing mentor interview data                                   |
| `mentee_application_file`      | File            | No*       | CSV file containing mentee application data                                 |
| `mentee_interview_file`        | File            | No*       | CSV file containing mentee interview data                                   |
| `importance_modifiers_json`    | String (JSON)   | No        | JSON string with importance modifiers for each category                     |
| `age_max_difference`           | Integer         | No        | Maximum allowed age difference in years (default: 30)                       |
| `geographic_max_distance`      | Integer         | No        | Maximum allowed geographic distance in km (default: 200)                    |
| `manual_matches_json`          | String (JSON)   | No        | JSON array of pairs to force as matches (format: `["mentor_id-mentee_id"]`) |
| `manual_non_matches_json`      | String (JSON)   | No        | JSON array of pairs to exclude (format: `["mentor_id-mentee_id"]`)          |

\* If files are not provided, the API will attempt to use default files from the `data/` directory.

**Importance Modifiers JSON Format:**
```json
{
  "gender": 1.0,
  "academia": 1.5,
  "languages": 0.8,
  "age_difference": 1.0,
  "geographic_proximity": 1.2
}
```

All modifiers are optional and default to `1.0` if not provided. Values typically range from `0.0` to `2.0`.

**Manual Matches/Non-Matches JSON Format:**
```json
["1-5", "2-7", "3-9"]
```

Each string follows the format `"mentor_id-mentee_id"`.

**Response:**

```json
{
  "category_scores": {
    "gender": {
      "1-5": {
        "gender_score": 1.0,
        "details": { ... }
      },
      ...
    },
    "academia": {
      "1-5": {
        "academic_score": 0.85,
        "mentee_academics": { ... },
        "mentor_academics": { ... },
        "mentoring_synergy": { ... }
      },
      ...
    },
    "languages": {
      "1-5": {
        "language_score": 0.92,
        "details": { ... }
      },
      ...
    },
    "age_difference": {
      "1-5": {
        "age_difference_score": 0.75,
        "details": { ... }
      },
      ...
    },
    "geographic_proximity": {
      "1-5": {
        "geographic_score": 0.88,
        "details": { ... }
      },
      ...
    }
  },
  "final_matches": [
    {
      "mentor_id": "1",
      "mentee_id": "5",
      "global_score": 0.88,
      "category_scores": {
        "gender": 1.0,
        "academia": 0.85,
        "languages": 0.92,
        "age_difference": 0.75,
        "geographic_proximity": 0.88
      },
      "rank": 1,
      ...
    },
    ...
  ]
}
```

**Response Fields:**

- `category_scores`: Dictionary containing detailed scores for each matching category (gender, academia, languages, age_difference, geographic_proximity). Keys are in format `"mentor_id-mentee_id"`.
- `final_matches`: List of final matched pairs with aggregated scores. Each match includes:
  - `mentor_id`: Mentor identifier
  - `mentee_id`: Mentee identifier
  - `global_score`: Overall compatibility score (0.0 to 1.0, or Infinity/-Infinity for manual matches/non-matches)
  - `category_scores`: Individual category scores
  - `rank`: Ranking of this match (if applicable)

**Example Request (cURL):**

```bash
curl -X POST "http://localhost:8000/matching" \
  -F "mentor_application_file=@mentors_app.csv" \
  -F "mentor_interview_file=@mentors_int.csv" \
  -F "mentee_application_file=@mentees_app.csv" \
  -F "mentee_interview_file=@mentees_int.csv" \
  -F "importance_modifiers_json={\"gender\": 1.0, \"academia\": 1.5}" \
  -F "age_max_difference=30" \
  -F "geographic_max_distance=200" \
  -F "manual_matches_json=[\"1-5\", \"2-7\"]" \
  -F "manual_non_matches_json=[\"1-3\"]"
```

**Example Request (JavaScript/Fetch):**

```javascript
const formData = new FormData();
formData.append('mentor_application_file', mentorAppFile);
formData.append('mentor_interview_file', mentorIntFile);
formData.append('mentee_application_file', menteeAppFile);
formData.append('mentee_interview_file', menteeIntFile);
formData.append('importance_modifiers_json', JSON.stringify({
  gender: 1.0,
  academia: 1.5,
  languages: 0.8
}));
formData.append('age_max_difference', '30');
formData.append('geographic_max_distance', '200');
formData.append('manual_matches_json', JSON.stringify(['1-5', '2-7']));

const response = await fetch('http://localhost:8000/matching', {
  method: 'POST',
  body: formData
});

const data = await response.json();
```

**Error Responses:**

- `400 Bad Request`: 
  - Missing required CSV files
  - Invalid JSON format for parameters
  - Invalid file format
- `404 Not Found`: 
  - Default CSV files not found in data directory
- `500 Internal Server Error`: 
  - Error processing files
  - Error in matching algorithm
  - Server-side exception

**Notes:**

1. **File Merging**: The API automatically merges application and interview CSVs on their ID columns (`Mentee Number` / `Mentor Number`) before processing.

2. **Score Ranges**: 
   - Normal scores: `0.0` to `1.0`
   - Manual matches: `Infinity` (or `1000` in some contexts)
   - Manual non-matches: `-Infinity` (or `-1000` in some contexts)
   - Blocked pairs (exceeding thresholds): `-Infinity`

3. **Key Format**: All pair keys in responses use the format `"mentor_id-mentee_id"` as strings for JSON compatibility.

4. **Performance**: Matching computation can take several seconds depending on the number of mentors and mentees. The API processes all pairs sequentially.

---

### Interactive API Documentation

FastAPI automatically generates interactive API documentation:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

These interfaces allow you to:
- View all available endpoints
- See request/response schemas
- Test endpoints directly from the browser
- View example requests and responses

---

## AI Usage in Development

This project was developed with active use of AI-assisted coding tools, specifically **Cursor** (powered by GPT-4) and **ChatGPT**. We believe in transparency about the role of AI in our development process.

### How AI Was Used

**Frontend Development**:
- The entire frontend codebase was written with AI assistance
- AI helped generate React components, TypeScript types, and UI styling
- Complex features like the bipartite graph visualization were built iteratively with AI guidance

**Backend Development**:
- AI served as an assistive tool for backend development
- Helped with code structure, API endpoint implementation, and data processing logic
- Assisted with debugging and error handling

### What AI Did NOT Do

- **Did not generate the core ideas**: The matching algorithm design, scoring methodology, and system architecture were conceived by the team
- **Did not design the system logic**: The overall system flow, data structures, and matching strategies were planned and specified by the team
- **Did not make architectural decisions**: Choices about technology stack, API design, and component structure were made by the team

### Challenges with AI Assistance

While AI was helpful, it sometimes hindered the development process:
- **Complex Changes**: When making nuanced frontend modifications, AI often misunderstood the specific requirements and made incorrect assumptions
- **Granular Steps**: For complex features requiring multiple interconnected changes, AI struggled to maintain context across the entire system
- **Edge Cases**: AI sometimes missed edge cases or didn't fully understand the implications of changes across different components

### Our Approach

We used AI as a **coding assistant**, not as a design partner. All high-level decisions, algorithmic choices, and system architecture were made by the team. AI helped translate our ideas into code, but the ideas themselves came from careful analysis of the problem domain and requirements.

This hybrid approach allowed us to move quickly while maintaining full understanding and control over the system's behavior and design.
