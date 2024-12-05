import requests

url = "http://127.0.0.1:5000/schedule"
data = {
    "employee_id": 1,
    "shift": "morning",
    "date": "2024-11-22",
    "file_path": "Schedule_2025_GV.xlsx"  # Corrected JSON format
}


response = requests.post(url, json=data)

print("Status Code:", response.status_code)
try:
    print("Response Body:", response.json())  # Try to parse JSON response
except requests.exceptions.JSONDecodeError:
    print("Response Body (not JSON):", response.text)  # Print plain text if JSON parsing fails
