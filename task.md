# AI-Powered Security & Police Scheduling System - Task Tracking

## Active Tasks

### Phase 1: Core Scheduling Infrastructure (Weeks 1-6)

#### Supervisor Schedule Interface
- [x] Design and implement employee preference data model
- [x] Create UI for capturing employee shift preferences
- [x] Develop quick fill buttons in ShiftModal


#### Officer Profile Enhancement
- [ ] Expand employee data model with additional fields (seniority, certifications, etc.)
- [ ] Create comprehensive officer profile management UI
- [ ] Implement historical pattern tracking for each officer
- [ ] Develop officer availability visualization

#### Excel Import System
- [ ] Create Excel file upload and mapping interface
- [ ] Develop template mapping system for various Excel formats
- [ ] Implement data extraction and validation pipeline
- [ ] Create historical data analysis tools for pattern recognition
- [ ] Build retention analytics based on historical scheduling

#### LightRAG Integration
- [x] Set up basic RAG implementation for Ollama
- [x] Design prompt templates for common scheduling queries
- [ ] ~~Implement LightRAG framework for improved retrieval~~ (Deprecated: migrating to LlamaIndex + FAISS)
- [ ] ~~Set up vector embeddings for policy chunks~~ (Deprecated: migrating to LlamaIndex + FAISS)
- [ ] ~~Create query reformulation for better understanding~~ (Deprecated: migrating to LlamaIndex + FAISS)
- [ ] ~~Develop dynamic retrieval based on query complexity~~ (Deprecated: migrating to LlamaIndex + FAISS)

---

#### LlamaIndex + FAISS Migration & Document Management (2025-04-12)
**Backend**
- [x] Remove LightRAG and BGE/pgvector RAG code — 2025-04-12
- [x] Add dependencies: llama-index, faiss-cpu, unstructured, requests — 2025-04-12
- [x] Scaffold LlamaIndex + FAISS integration module and stub /api/policies/search endpoint — 2025-04-12
- [x] Implement custom embedding and LLM classes for Ollama (nomic-embed-text, llama3:8b)
- [x] Build document ingestion pipeline (TXT, PDF, DOCX upload, extraction, chunking, embedding)
- [x] Store chunks and metadata in DB; store vectors in FAISS index
- [x] Implement vector search API: POST /api/policies/search (query, top_k)
- [x] Implement prompt augmentation (combine schedule and policy context) — 2025-04-12
- [x] Database migration: add chunk_count, status, error_message to PolicyDocument — 2025-04-12
- [x] Add FAISS index persistence (save/load, re-index on update/delete) — 2025-04-12
- [x] Add Pytest unit tests for ingestion, search, and API

**Backend Document Management API**
- [x] List all documents (metadata: name, type, upload date, size, status, chunk count)
- [x] Upload new documents (TXT, PDF, DOCX)
- [x] Download/view document content (original and extracted text)
- [x] Delete documents (with re-indexing)
- [x] Re-index documents (manual trigger)
- [x] Show chunking/embedding status and errors

**Frontend**
- [x] Table/grid of all documents (sortable, filterable, with status) — 2025-04-12
- [x] Upload button (multi-file) — 2025-04-12
- [x] View/download buttons for each document — 2025-04-12
- [x] Delete button (with confirmation) — 2025-04-12
- [x] Status indicators ("Indexed", "Pending", "Error") — 2025-04-12
- [x] Re-index button — 2025-04-12
- [x] Search/filter by name/type/status — 2025-04-12
- [x] Show extracted text/chunks for each document — 2025-04-12

### Phase 2: AI-Powered Intelligence (Weeks 7-11)

#### Schedule Analysis Engine
- [ ] Implement real-time conflict detection system
- [ ] Develop gap analysis for uncovered shifts
- [ ] Create staffing level analysis against requirements
- [ ] Build future issue prediction based on current schedule
- [ ] Implement change impact analysis for schedule modifications

#### Recommendation System
- [x] Create context retrieval system for employee data
- [x] Implement AI suggestion display in the UI
- [x] Develop feedback mechanism for AI suggestions
- [x] Parse AI JSON suggestions and apply schedule updates
- [x] Save schedule snapshots before AI changes
- [x] Implement undo for AI-driven schedule changes
- [ ] Develop bulk scheduling capability for extended periods
- [ ] Create optimization algorithms for schedule quality

#### Pattern Recognition
- [ ] Implement historical pattern analysis from imported data
- [ ] Create officer preference inference system
- [ ] Develop retention correlation analytics
- [ ] Build schedule quality metrics

#### Enhanced AI Integration
- [ ] Refine prompt engineering with scheduling constraints
- [ ] Implement contextual policy application
- [ ] Build comprehensive schedule suggestion system
- [ ] Create AI explanation component for recommendations

### Phase 3: Time-Off Management (Weeks 12-16)

#### Request System
- [ ] Create time-off request submission portal
- [ ] Develop supervisor approval workflow
- [ ] Implement schedule impact analysis for requests
- [ ] Build email integration for processing emailed requests

#### Intelligent Substitution
- [ ] Create vacancy detection and analysis system
- [ ] Implement substitute officer recommendation engine
- [ ] Develop supervisor action center with contact tools
- [ ] Build substitution response tracking
- [ ] Implement learning system for improved recommendations

#### Annual Vacation Selection
- [ ] Create round-based selection interface
- [ ] Implement seniority-based ordering system
- [ ] Develop availability visualization
- [ ] Build selection history and audit trail
- [ ] Implement "pass" functionality and round progression

#### Training & Special Assignment
- [ ] Create manual entry interface for supervisors
- [ ] Implement automatic schedule updates for approved training
- [ ] Develop calendar integration for training events
- [ ] Build qualification tracking system

### Phase 4: Advanced Features & Integration (Weeks 17-20)

#### Data Visualization
- [ ] Create interactive schedule visualizations
- [ ] Implement coverage and workload distribution charts
- [ ] Develop conflict and issue highlighting
- [ ] Build predictive analytics visualizations

#### Department-Specific Features
- [ ] Implement Police Division Module with 24/7 requirements
- [ ] Create Security Division Module with flexible scheduling
- [ ] Develop cross-division resource allocation
- [ ] Build department-specific policy application

#### Advanced Analytics
- [ ] Implement predictive absence forecasting
- [ ] Create schedule quality metrics dashboard
- [ ] Develop retention risk analysis
- [ ] Build cost analysis for different scheduling scenarios

#### System Integration
- [ ] Ensure seamless operation between all components
- [ ] Implement comprehensive API for future integrations
- [ ] Create data export capabilities
- [ ] Build backup and restore functionality

### Phase 5: Refinement & Deployment (Weeks 21-22)

#### Testing & Error Handling
- [ ] Implement comprehensive unit tests
- [ ] Create integration tests for system components
- [ ] Develop robust error handling and recovery
- [ ] Build extensive logging system

#### UI/UX Refinement
- [ ] Enhance dashboard visualizations
- [ ] Optimize user workflows
- [ ] Implement responsive design for different devices
- [ ] Create user onboarding guides

#### Deployment Preparation
- [ ] Create deployment scripts and automation
- [ ] Develop backup and recovery procedures
- [ ] Write detailed documentation
- [ ] Create user training materials

#### Performance Optimization
- [ ] Implement caching strategies
- [ ] Optimize database queries
- [ ] Fine-tune AI response time
- [ ] Conduct load testing and optimization

## Technology Research Tasks (Weeks 1-3)

### Vector Database Evaluation
- [ ] Research available vector database options (PostgreSQL/pgvector, Pinecone, Chroma, Weaviate, FAISS)
- [ ] Create benchmark tests for policy document retrieval
- [ ] Test query performance with varying document volumes
- [ ] Evaluate integration complexity with Flask
- [ ] Document findings and make recommendation

### Embedding Model Selection
- [ ] Research available embedding models suitable for policy documents
- [ ] Create evaluation framework for semantic accuracy
- [ ] Benchmark computational requirements of different models
- [ ] Test retrieval quality with sample policy documents
- [ ] Document findings and make recommendation

### LightRAG Implementation Research

#### Policy Vector Search API
- [ ] Design Policy Vector Search API (query, top_k, response format)
- [ ] Implement `/api/policies/search` endpoint with pgvector similarity search
- [ ] Test Policy Vector Search API with sample queries
- [ ] Integrate Policy Vector Search into AI query flow
- [ ] Add unit tests for Policy Vector Search (expected, edge, failure cases)

#### Phase 1: Vector DB & Embedding Model Selection
- [ ] Benchmark current retrieval (latency, accuracy, limitations)
- [ ] Research and select vector database (pgvector, Pinecone, Chroma, Weaviate, FAISS)
- [ ] Research and select embedding model (OpenAI, SentenceTransformers, BGE, E5)
- [ ] Decide whether to keep or replace current vector DB and embeddings

#### Phase 2: Embedding Generation & Indexing
- [ ] Generate embeddings for all existing policy chunks
- [ ] Store embeddings with chunk IDs and metadata
- [ ] Build vector index in chosen vector DB
- [ ] Update policy ingestion pipeline to embed and index on upload

#### Phase 3: LightRAG Integration
- [ ] Clone and review LightRAG repo
- [ ] Integrate LightRAG with backend using chosen vector DB and embeddings
- [ ] Configure retrieval modes (local, global, hybrid, mix)
- [ ] Enable knowledge graph features if desired
- [ ] Implement `/api/policies/search` endpoint using LightRAG
- [ ] Update AI prompt construction with retrieved policy context

#### Phase 4: Testing & Optimization
- [ ] Test retrieval quality and latency
- [ ] Benchmark against current RAG implementation
- [ ] Tune top-k, chunking, embedding parameters
- [ ] Document integration and update architecture diagrams
- [ ] Plan embedding update strategy (incremental, periodic)
- [ ] Define fallback strategies if vector search fails


- [ ] Clone and review https://github.com/HKUDS/LightRAG
- [ ] Evaluate LightRAG API and architecture
- [ ] Prepare policy chunk dataset for embedding
- [ ] Generate embeddings using SentenceTransformers
- [ ] Build FAISS index with LightRAG
- [ ] Implement `/api/policies/search` endpoint
- [ ] Test retrieval quality with sample queries
- [ ] Compare retrieval speed and relevance vs. current RAG
- [ ] Document integration plan and update architecture diagrams
- [ ] Plan embedding update strategy on new uploads
- [ ] Define fallback if LightRAG retrieval fails

### Schedule Optimization Algorithm Research
- [ ] Research scheduling algorithm approaches (constraint satisfaction, genetic algorithms, etc.)
- [ ] Create test scenarios based on actual scheduling requirements
- [ ] Implement prototype algorithms for comparative testing
- [ ] Evaluate solution quality and computational efficiency
- [ ] Document findings and recommended approach

### Excel Import Strategy Research
- [ ] Collect sample Excel spreadsheets representing historical schedules
- [ ] Analyze format variations and data inconsistencies
- [ ] Research approaches for robust data extraction
- [ ] Prototype and test different mapping strategies
- [ ] Document recommended approach for implementation

### Real-time Collaboration Research
- [ ] Research technologies for concurrent editing (WebSockets, OT, CRDTs)
- [ ] Evaluate conflict resolution approaches
- [ ] Create prototype for testing collaboration scenarios
- [ ] Assess performance under simulated concurrent use
- [ ] Document findings and recommended approach

### Deployment Architecture Research
- [ ] Analyze requirements for different system components
- [ ] Research scaling needs and patterns
- [ ] Evaluate deployment options (monolithic, microservices, serverless)
- [ ] Create cost models for different architecture options
- [ ] Document recommended architecture with rationale

### Mobile Access Strategy Research
- [ ] Evaluate user needs for mobile access
- [ ] Research development approaches (PWA, React Native, native)
- [ ] Create UI prototypes for different approaches
- [ ] Assess development effort and maintenance requirements
- [ ] Document findings and recommended approach

## Research Deliverables
- [ ] Comprehensive technology evaluation report
- [ ] Architecture decision documents for each major component
- [ ] Prototype documentation and findings
- [ ] Updated implementation plan with selected technologies
- [ ] Risk assessment for selected technologies

## Policy Management (In Progress)
- [x] Design policy document database schema
- [x] Create document upload and processing pipeline
- [x] Implement chunking algorithm for policy documents
- [ ] Set up vector embeddings for policy chunks
- [ ] Build policy retrieval integration with LightRAG system
- [x] Develop frontend UI for uploading policy documents
- [x] Create UI to list and view uploaded policies
- [x] Implement download and delete functionality for policies
- [x] Display extracted text and metadata in UI
- [ ] Create policy impact analysis for scheduling decisions
- [ ] Develop policy explanation feature for supervisors

## AI Assistant UI Enhancements (Optional/Future)
- [x] Persistent conversations with backend storage
- [x] Inline renaming, deleting, switching chats
- [x] Dark/light theme toggle
- [x] Settings panel
- [x] Tailwind CSS responsive redesign
- [ ] Streaming AI responses
- [ ] Profile management UI
- [ ] Export/import conversations
- [ ] Advanced settings (model selection, temperature)
- [ ] Chat message editing or deleting
- [ ] Conversation search/filter
- [ ] Notifications or alerts

## Verified Completed Tasks (as of 2025-04-09)
All the following have been **confirmed implemented and functional** after code review:

- [x] Initialize PostgreSQL + pgvector database schema via Alembic migrations (2025-04-09)
- [x] Design and implement employee preference data model
- [x] Create UI for capturing employee shift preferences
- [x] Develop quick fill buttons in ShiftModal
- [x] Set up basic RAG implementation for Ollama
- [x] Design prompt templates for common scheduling queries
- [x] Create context retrieval system for employee data
- [x] Implement AI suggestion display in the UI
- [x] Develop feedback mechanism for AI suggestions
- [x] Parse AI JSON suggestions and apply schedule updates
- [x] Save schedule snapshots before AI changes
- [x] Implement undo for AI-driven schedule changes
- [x] Design policy document database schema
- [x] Create document upload and processing pipeline
- [x] Implement chunking algorithm for policy documents
- [x] Develop frontend UI for uploading policy documents
- [x] Create UI to list and view uploaded policies
- [x] Implement download and delete functionality for policies
- [x] Display extracted text and metadata in UI
- [x] Persistent conversations with backend storage
- [x] Inline renaming, deleting, switching chats
- [x] Dark/light theme toggle
- [x] Settings panel
- [x] Tailwind CSS responsive redesign

## Discovered During Work (2025-04-09)
- 2025-04-12: Added React Testing Library unit tests for PolicyManager UI (expected, edge, and failure cases).
- 2025-04-12: Updated README.md with PolicyManager UI features and frontend test instructions.
- 2025-04-12: Fixed Alembic migration and Docker Compose .env issues; database schema for PolicyDocument is now fully in sync with backend and frontend requirements.
- Backend is Flask.
- LightRAG integration is **not yet complete**; embeddings and vector search partially scaffolded.
- Excel import system is **not yet started**.
- Time-off management, substitution, vacation selection **not yet started**.
- Need to add unit tests for existing features (Phase 5).
- Consider adding API docs (e.g., Swagger) for easier frontend/backend integration.

---

### Completed 2025-04-09: Fix Dockerized Frontend/Backend Communication

- Refactored all frontend API calls to use a centralized `apiFetch()` helper with `REACT_APP_API_URL`.
- Updated `docker-compose.yml` to set `REACT_APP_API_URL=http://backend:5000`.
- Fixed all relative API URLs in React components and utils.
- Confirmed backend connects to Postgres via Docker network alias `db`.
- Updated README.md with Docker networking instructions.
- Frontend, backend, and database now communicate correctly inside Docker.

## Discovered Tasks
- 2025-04-12: Created backend/utils/llamaindex_faiss.py module and stubbed /api/policies/search endpoint for LlamaIndex + FAISS integration.
- 2025-04-12: Migrating from LightRAG/pgvector/BGE to LlamaIndex + FAISS + Ollama embeddings for all policy/document RAG and search. LightRAG tasks deprecated.
- 2025-04-12: FAISS index and metadata are now persisted to disk and loaded automatically on backend startup for robust, production-ready search.
*This section will be populated as new requirements or tasks are discovered during development.*
- 2025-04-12: [x] Fix backend PDF extraction and FAISS ingestion errors. Investigate and resolve `ModuleNotFoundError: No module named 'pdfplumber'` and `ModuleNotFoundError: No module named 'backend'` in backend Docker environment. Ensure all dependencies are installed and Python path is correctly set for package imports.
- 2025-04-12: [x] Fix FAISS ingestion error (`No module named 'faiss'`) by updating backend Dockerfile to install system dependencies (`g++`, `libopenblas-dev`, `wget`) before pip install. Confirmed faiss-cpu is now importable in the backend container.

- 2025-04-12: Fix backend PDF extraction and FAISS ingestion errors. Investigate and resolve `ModuleNotFoundError: No module named 'pdfplumber'` and `ModuleNotFoundError: No module named 'backend'` in backend Docker environment. Ensure all dependencies are installed and Python path is correctly set for package imports.

---

### Completed Tasks

- [x] Enable Ollama Python client support in lightrag/lightrag/llm/ollama.py (uncomment import, implement functions, add to requirements.txt) — 2025-04-12


- [ ] Need to define specific policy types and priority rules
- [ ] Consider seasonal scheduling patterns and special events
- [ ] Evaluate performance of different embedding models for policy chunks
- [ ] Develop system for handling emergency call-ins and last-minute schedule changes
- [ ] Create metrics for measuring schedule fairness across officers
- [ ] Build visualization for long-term scheduling trends and patterns
- [ ] Implement configurable staffing thresholds for different shifts and positions
- [ ] Develop onboarding process for new officers into the scheduling system
