# Employee Scheduling AI

This project leverages artificial intelligence (AI) to automate and optimize the scheduling process for law enforcement and security personnel. The system helps to efficiently assign shifts, balance time off, and account for various scheduling constraints such as holidays, training sessions, and shift preferences.

## Features

- **Automated Shift Assignment**: The AI analyzes employee availability, shift preferences, and historical data to generate optimal schedules.
- **AI Model Integration**: The system utilizes a Hugging Face pre-trained model to predict optimal scheduling patterns based on historical data and constraints.
- **Flexible Configuration**: The AI is designed to work with various shift models and employee preferences.
- **Real-time Updates**: The system supports real-time updates, allowing for quick adjustments when shifts are canceled or when there are urgent changes.
- **Excel Integration**: The AI can read and manipulate scheduling data in Excel format, making it easy to import, export, and share schedules.

## Technologies Used

- **Flask**: A Python-based web framework used to create the API endpoints for the scheduling service.
- **Pandas**: A powerful data manipulation library used for handling schedule data in Excel format.
- **Transformers (Hugging Face)**: Pre-trained AI models used for processing and predicting the best schedules.
- **Docker**: Used for containerizing the application to ensure that it can run consistently across different environments.
- **PostgreSQL**: A relational database used for storing employee data and scheduling history.

## Setup Instructions

1. **Clone the repository**:
   ```
   git clone https://github.com/your-username/employee-scheduling-ai.git
   cd employee-scheduling-ai
   ```

2. **Install dependencies**:
   The project uses `requirements.txt` to manage dependencies. Install the necessary Python libraries by running:
   ```
   pip install -r backend/requirements.txt
   ```

3. **Create a `.env` file**:
   Create a `.env` file in the root directory and add your Hugging Face token:
   ```
   HUGGINGFACE_TOKEN=your_hugging_face_token_here
   ```

4. **Run the application**:
   You can run the Flask app using the following command:
   ```
   python backend/app.py
   ```

   This will start the web server, and the API will be accessible at `http://localhost:5000`.

5. **Docker Setup** (Optional):
   The project includes Dockerfiles for containerizing both the backend and frontend. To build and run the application using Docker:
   ```
   docker-compose up --build
   ```

   This will launch the app in containers, including the database and web services.

## API Endpoints

### `POST /schedule`

- **Description**: This endpoint processes a schedule file and returns predictions based on the provided data.
- **Request Body**:
  ```json
  {
    "file_path": "path_to_your_schedule_file.xlsx"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Schedule processed",
    "predictions": [0, 1, 2, 1, 0]
  }
  ```

### Example Input

- A typical input schedule file should be an Excel file with one or more sheets, where each sheet contains scheduling data (e.g., employee names, shift types, time off, etc.).

## Contributing

1. **Fork the repository**.
2. **Create a new branch** for your feature or bugfix.
3. **Make your changes** and ensure that they are tested.
4. **Commit your changes** and push them to your fork.
5. **Submit a pull request** describing your changes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Hugging Face for providing pre-trained models and APIs.
- Flask for simplifying API development.
- Pandas for handling data in a structured way.