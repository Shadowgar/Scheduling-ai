from flask import Flask, request, jsonify
import pandas as pd
from huggingface_hub import login
from transformers import AutoModelForSequenceClassification, AutoTokenizer  # Change this if needed
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Get Hugging Face token from the environment
token = os.getenv("HUGGINGFACE_TOKEN")

if token:
    login(token=token)
else:
    raise ValueError("Hugging Face token is missing!")

# Initialize Flask app
app = Flask(__name__)

# Load the pre-trained model and tokenizer from Hugging Face
model_name = "ibm-granite/granite-timeseries-ttm-r1"
model = AutoModelForSequenceClassification.from_pretrained(model_name)  # Change this to the correct class if needed
tokenizer = AutoTokenizer.from_pretrained(model_name)

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
    inputs = tokenizer(input_data, return_tensors="pt", padding=True, truncation=True, max_length=512)
    outputs = model(**inputs)
    predictions = outputs.logits.argmax(axis=-1).tolist()  # This may need adjusting based on model output
    return predictions

def preprocess_data(schedule_data):
    # Example: Convert the schedule data into a format suitable for the model
    # This would likely involve converting numerical time-series data or structured data into the right input format
    # Example: Convert your schedule data into text or a numerical array
    input_data = "Preprocessed schedule data in a format suitable for time-series prediction"  # Update this
    return input_data

# Main entry point for running the Flask app
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
