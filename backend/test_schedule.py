import requests

# URL for the Flask API
url = "http://127.0.0.1:5000/schedule"

# JSON data to send with the request
data = {
    "file_path": "Schedule_2025_GV.xlsx"  # Name of your Excel workbook
}

try:
    # Send a POST request to the API
    response = requests.post(url, json=data)
    # Print the response from the server
    print("Response from server:", response.json())
except Exception as e:
    print("Error occurred:", e)
