
# Employee Scheduling Application

This project is a web-based application designed to help manage employee schedules, particularly aimed at environments like law enforcement or security, but adaptable to other shift-based work. It provides a user interface for supervisors to manage employees and assign shifts, and for employees to view their schedules. The application features a modern and sleek design with a consistent look and feel across all components, using a cohesive color palette, subtle box shadows, and rounded corners for a visually appealing experience.


---

## Core Features

- **User Authentication**: Secure login/logout functionality using JWT (JSON Web Tokens).
- **Role-Based Access Control**: Supervisors can manage employees and shifts; employees can view schedules.
- **Employee Management**: CRUD operations.
- **Shift Management**: CRUD operations.
- **Interactive Calendar View**: Monthly grid with modals.
- **RESTful API Backend**: Flask.
- **React Frontend**: Dynamic UI.
- **AI Assistant**:
  - ChatGPT-like interface with persistent conversations.
  - Automated schedule modifications via AI.
  - Undo/redo schedule changes.
  - Dark/light theme toggle.
  - Settings panel.
  - Tailwind CSS responsive design.
- **Policy Management**: Upload, view, and manage policy documents.
- **Schedule Snapshots**: Save and restore schedule states.

---

## Technologies Used

- **Backend**:
  - Python, Flask, Flask-SQLAlchemy, Flask-Migrate, Flask-JWT-Extended, Flask-CORS
  - PostgreSQL
  - Alembic, Pydantic, Pytest
- **Frontend**:
  - React, React Router
  - Tailwind CSS
  - Fetch API
- **Containerization (Optional)**:
  - Docker, Docker Compose

---

## Project Structure
```

employee-scheduling-ai/
├── backend/
│   ├── migrations/
│   ├── venv/          # Virtual environment (ignored by git)
│   ├── app.py         # Main Flask application
│   ├── models.py      # (Optional separation for DB models)
│   ├── requirements.txt # Backend Python dependencies
│   └── .env           # Backend environment variables (ignored by git)
├── frontend/
│   ├── node_modules/  # Node dependencies (ignored by git)
│   ├── public/
│   ├── src/           # React source code
│   ├── package.json   # Frontend dependencies and scripts
│   └── .env.local     # Frontend environment variables (ignored by git)
├── docker-compose.yml # (If using Docker)
├── Dockerfile.backend # (If using Docker)
├── Dockerfile.frontend # (If using Docker)
└── README.md        # This file

```javascript
## Setup Instructions

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/employee-scheduling-ai.git # Replace with your repo URL
    cd employee-scheduling-ai
```

2.  **Backend Setup**:

```bash
    cd backend

    # Create and activate a Python virtual environment
    python -m venv venv
    # On Windows:
    .\venv\Scripts\activate
    # On macOS/Linux:
    # source venv/bin/activate

    # Install Python dependencies
    pip install -r requirements.txt

    # Create a .env file in the 'backend' directory
    # Add your database connection string and a JWT secret key:
    # Example .env content:
    # DATABASE_URL=postgresql://user:password@host:port/database_name
    # JWT_SECRET_KEY=your_strong_random_secret_key_here

    # Ensure your PostgreSQL database server is running and the specified database exists.

    # Initialize and apply database migrations
    # (Run these commands inside the 'backend' directory with venv active)
    flask db init  # Only needed the very first time
    flask db migrate -m "Initial database schema" # Or a descriptive message
    flask db upgrade # Apply migrations to the database
```

    *Note: You might need to set `FLASK_APP=app.py` as an environment variable before running `flask db` commands if your OS doesn't pick it up automatically.*

3.  **Frontend Setup**:

```bash
    cd ../frontend

    # Install JavaScript dependencies
    npm install
    # or if you use yarn:
    # yarn install
```

    *Note: The frontend uses a proxy setting in `package.json` to communicate with the backend during development.*

## Running the Application

1.  **Run the Backend Server**:

    -   Navigate to the `backend` directory.
    -   Ensure your virtual environment is activated.
    -   Ensure your PostgreSQL server is running.
    -   Start the Flask development server:

```bash
        flask run
```

    -   The backend API will typically be available at `http://localhost:5000`.

2.  **Run the Frontend Development Server**:

    -   Navigate to the `frontend` directory in a **separate terminal**.
    -   Start the React development server:

```bash
        npm start
        # or
        # yarn start
```

    -   The frontend application will typically open automatically in your browser at `http://localhost:3000`.

## API Endpoints

The backend provides the following REST API endpoints under the `/api` prefix:

-   **Authentication:**
    -   `POST /api/auth/login`: Authenticate user, returns JWT token and user info.
    -   `GET /api/auth/me`: Get current logged-in user's info (requires valid JWT).
-   **Employees:**
    -   `GET /api/employees`: List all employees (viewable by anyone).
    -   `POST /api/employees`: Create a new employee (requires supervisor JWT).
    -   `GET /api/employees/<id>`: Get details for a specific employee (requires JWT; supervisor or self).
    -   `PUT /api/employees/<id>`: Update details for a specific employee (requires JWT; supervisor or self, with field restrictions).
    -   `DELETE /api/employees/<id>`: Delete an employee (requires supervisor JWT).
-   **Shifts:**
    -   `GET /api/shifts`: List shifts (viewable by anyone; requires `year` and `month` query params).
    -   `POST /api/shifts`: Create a new shift (requires supervisor JWT).
    -   `GET /api/shifts/<id>`: Get details for a specific shift (requires JWT).
    -   `PUT /api/shifts/<id>`: Update a specific shift (requires supervisor JWT).
    -   `DELETE /api/shifts/<id>`: Delete a specific shift (requires supervisor JWT).

## Docker Setup (Optional)

If `docker-compose.yml` and associated `Dockerfile`s are configured:

1.  Ensure Docker and Docker Compose are installed.
2.  Make sure your `.env` file is correctly set up in the `backend` directory (Docker Compose might be configured to use it).
3.  **Important:** The frontend container communicates with the backend container using an internal Docker network hostname.  
    - The environment variable `REACT_APP_API_URL` **must be set to** `http://backend:5000` **inside Docker**.  
    - This is already configured in `docker-compose.yml`:
      ```
      environment:
        - REACT_APP_API_URL=http://backend:5000
      ```
    - **Do not use `localhost` or `127.0.0.1` here**, as that would point to the frontend container itself, not the backend.
4.  From the project root directory:

```bash
    docker-compose up --build
```

5.  This command should build the images for the frontend, backend, and potentially the database, then start the containers. Access the application via the port exposed by the frontend service (likely `localhost:3000`).

## Contributing

1.  Fork the repository.
2.  Create a new branch for your feature or bugfix (`git checkout -b feature/your-feature-name`).
3.  Make your changes and ensure they are tested.
4.  Commit your changes (`git commit -am 'Add some feature'`).
5.  Push the branch to your fork (`git push origin feature/your-feature-name`).
6.  Submit a pull request to the original repository.

## License

This project is likely licensed under the MIT License (verify `LICENSE` file).

## Acknowledgments

-   Flask development team and community.
-   React development team and community.
-   Contributors to Flask extensions (SQLAlchemy, Migrate, JWT-Extended, CORS).
-   PostgreSQL development team.

## Security Considerations

This project uses JWT for authentication. Ensure that the `JWT_SECRET_KEY` environment variable is set to a strong, randomly generated value in production.

**Important:** Avoid committing sensitive information (e.g., API keys, database passwords) directly to the repository. Use environment variables and secure configuration practices.
```
