from flask import Flask, request, jsonify
import pandas as pd

app = Flask(__name__)

# Route to handle schedule processing
@app.route('/schedule', methods=['POST'])
def schedule():
    data = request.json
    # Load the schedule from the provided Excel file path
    schedule_data = load_schedule(data['file_path'])  # Assuming the file path is in the request JSON
    return jsonify({"message": "Schedule processed", "data": schedule_data})

# Function to load all sheets from the Excel workbook
def load_schedule(file_path):
    try:
        # Read all sheets
        df = pd.read_excel(file_path, sheet_name=None)
        # Process each sheet
        cleaned_data = {}
        for sheet, data in df.items():
            # Drop NaN columns and rows, or replace NaN with empty strings
            data = data.dropna(how='all')  # Remove empty rows
            data = data.fillna("")         # Replace NaN with ""
            cleaned_data[sheet] = data.to_dict()
        return cleaned_data
    except Exception as e:
        return {"error": str(e)}


# Main entry point for running the Flask app
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)


