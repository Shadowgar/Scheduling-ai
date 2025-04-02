# backend/models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Employee(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    job_title = db.Column(db.String(100))
    access_role = db.Column(db.String(50), default='employee')  # 'employee' or 'supervisor'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    schedules = db.relationship('Schedule', backref='employee', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'job_title': self.job_title,
            'access_role': self.access_role
        }

class Schedule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employee.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    shift = db.Column(db.String(50), nullable=False)  # e.g., 'morning', 'evening', 'night'
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee_name': self.employee.name,
            'date': self.date.isoformat(),
            'shift': self.shift,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat()
        }

class OllamaQuery(db.Model):
    """
    Store Ollama queries and responses for future reference and improvement
    """
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('employee.id'), nullable=False)
    query = db.Column(db.Text, nullable=False)
    response = db.Column(db.Text, nullable=False)
    model_used = db.Column(db.String(50), default='llama3')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('Employee', backref='ollama_queries')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.name,
            'query': self.query,
            'response': self.response,
            'model_used': self.model_used,
            'created_at': self.created_at.isoformat()
        }
