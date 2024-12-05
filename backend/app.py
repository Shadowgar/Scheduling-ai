from flask import Flask, request, jsonify
import pandas as pd
from huggingface_hub import login
from custom_model import TinyTimeMixerConfig, TinyTimeMixerForPrediction
from dotenv import load_dotenv
import torch
import os

# Load environment variables from .env file
load_dotenv()

# Get Hugging Face token from the environment
token = os.getenv("HUGGINGFACE_TOKEN")

if token:
    login(token=token)
    print(f"Logged in with token: {token[:10]}...")  # To confirm token is loaded (only showing part of it)
else:
    raise ValueError("Hugging Face token is missing!")

# Initialize Flask app
app = Flask(__name__)

# Load the pre-trained custom model
model_name = "ibm-granite/granite-timeseries-ttm-r1"

# Load configuration and initialize the custom model
config = TinyTimeMixerConfig.from_pretrained(model_name)
model = TinyTimeMixerForPrediction(config)

# Route to handle schedule processing
@app.route('/schedule', methods=['POST'])
def schedule():
    data = request.json
    file_path = data['file_path']
    schedule_data = load_schedule(file_path)
    predictions = make_predictions(schedule_data)
    return jsonify({"message": "Schedule processed", "predictions": predictions})

def load_schedule(file_path):
    try:
        df = pd.read_excel(file_path, sheet_name=None)
        cleaned_data = {}
        for sheet, data in df.items():
            data = data.dropna(how='all')
            data = data.fillna("")
            cleaned_data[sheet] = data.to_dict()
        return cleaned_data
    except Exception as e:
        return {"error": str(e)}

def make_predictions(schedule_data):
    # Preprocess the schedule data into the format expected by the model
    input_data = preprocess_data(schedule_data)

    # Convert the input into a tensor
    input_tensor = torch.tensor(input_data, dtype=torch.float32).unsqueeze(0)  # Add batch dimension

    # Run the input through the custom model
    with torch.no_grad():
        outputs = model(input_tensor)

    # Process outputs (adjust based on your model's architecture)
    predictions = outputs.tolist()
    return predictions

def preprocess_data(schedule_data):
    # Example: Convert the schedule data into a numerical format suitable for the model
    # Replace this with actual preprocessing logic
    input_data = [[1.0, 2.0, 3.0, 4.0, 5.0]]  # Dummy example
    return input_data

# Main entry point for running the Flask app
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
