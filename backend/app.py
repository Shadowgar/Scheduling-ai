from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/schedule', methods=['POST'])
def schedule():
    # Placeholder for AI logic
    data = request.json
    return jsonify({"message": "Schedule processed", "data": data})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
