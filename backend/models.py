# backend/models.py
from .extensions import db
from werkzeug.security import generate_password_hash, check_password_hash # Import hashing functions

class Employee(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='employee') # Ensure role exists

    # --- Authentication Fields ---
    email = db.Column(db.String(120), unique=True, nullable=False, index=True) # Use email for login
    password_hash = db.Column(db.String(256), nullable=False) # Increased length for hash

    # --- Relationships ---
    # Add back your shifts relationship if you removed it
    shifts = db.relationship('Shift', backref='employee', lazy=True, cascade="all, delete-orphan")

    # --- Password Methods ---
    def set_password(self, password):
        """Hashes the password and stores it."""
        if not password:
             raise ValueError("Password cannot be empty")
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Checks if the provided password matches the stored hash."""
        if not self.password_hash: # Should not happen if validation is correct
            return False
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<Employee {self.name} ({self.role})>'

    # Method to serialize Employee data (excluding password)
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'role': self.role,
            'email': self.email
            # DO NOT include password_hash here!
        }

# --- Shift Model (ensure it exists) ---
class Shift(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employee.id'), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    notes = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f'<Shift {self.id} for Employee {self.employee_id}>'

    # Method to serialize Shift data
    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'notes': self.notes,
            # Optionally include employee name if needed, requires joining or accessing relationship
            # 'employee_name': self.employee.name if self.employee else None
        }