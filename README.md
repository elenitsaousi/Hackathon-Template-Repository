# SEET Match
- Eleni Tsaousi
- Patrik Valach
- Margareta Karaqi

SEET provides invaluable mentoring to help refugees enter higher education in Switzerland. Currently,
the process of matching a new mentee with the right volunteer mentor is done manually. This is timeconsuming and limits the program's ability to scale. An effective match is critical for success and depends on complex factors like academic goals, field of study, language skills, and personality.

The challenge is to design a system that automates and enhances this matching process. The goal is to
create a tool that helps SEET administrators make faster, higher-quality matches between refugee
mentees and volunteer mentors, ultimately improving outcomes for the mentees, and making the
program more scalable.


## Our Solution

SEET Match is an intelligent mentor-mentee matching system that automates and optimizes the pairing process. The solution combines data-driven matching algorithms with an intuitive visual interface to help administrators make faster, higher-quality matches.

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
*(Add screenshots here showing the graph visualization, parameter controls, and detail panels)*

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
- **Real-time Updates** - Dynamic UI updates as matching parameters change
- **CORS-enabled** - Cross-origin resource sharing for frontend-backend communication
