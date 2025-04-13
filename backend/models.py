import enum
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone, date, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.dialects.postgresql import JSONB

db = SQLAlchemy()

class EmployeeStatus(enum.Enum):
    ACTIVE = 'active'
    INACTIVE = 'inactive'
    ON_LEAVE = 'on_leave'
    TERMINATED = 'terminated'

class AccessRole(enum.Enum):
    SUPERVISOR = 'supervisor'
    MEMBER = 'member'

class Employee(db.Model):
    __tablename__ = 'employees'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(20), nullable=True)

    job_title = db.Column(db.String(100), nullable=False)
    access_role = db.Column(
        db.Enum(
            AccessRole,
            name='accessroleenum',
            values_callable=lambda x: [e.value for e in x]
        ),
        nullable=False,
        default=AccessRole.MEMBER,
        server_default=AccessRole.MEMBER.value
    )

    hire_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.Enum(EmployeeStatus), nullable=False, default=EmployeeStatus.ACTIVE)
    seniority_level = db.Column(db.Integer, nullable=True)
    max_hours_per_week = db.Column(db.Integer, nullable=True)
    min_hours_per_week = db.Column(db.Integer, nullable=True)
    password_hash = db.Column(db.String(256), nullable=False)
    show_on_schedule = db.Column(db.Boolean, nullable=False, default=True, server_default='true')
    
    # Add missing columns from your database
    preferred_shifts = db.Column(db.Text, nullable=True)
    preferred_days = db.Column(db.Text, nullable=True)
    days_off = db.Column(db.Text, nullable=True)
    max_hours = db.Column(db.Integer, nullable=True)
    max_shifts_in_a_row = db.Column(db.Integer, nullable=True)
    
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), 
                          default=lambda: datetime.now(timezone.utc), 
                          onupdate=lambda: datetime.now(timezone.utc))
    
    shifts = db.relationship('Shift', backref='employee', lazy=True, cascade="all, delete-orphan")
    ollama_queries = db.relationship('OllamaQuery', backref='employee', lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        if not password:
             raise ValueError("Password cannot be empty")
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<Employee {self.id}: {self.name} ({self.job_title} - {self.access_role.value})>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'job_title': self.job_title,
            'access_role': self.access_role.value,
            'hire_date': self.hire_date.isoformat() if self.hire_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'status': self.status.value,
            'seniority_level': self.seniority_level,
            'max_hours_per_week': self.max_hours_per_week,
            'min_hours_per_week': self.min_hours_per_week,
            'show_on_schedule': self.show_on_schedule,
            'preferred_shifts': self.preferred_shifts,
            'preferred_days': self.preferred_days,
            'days_off': self.days_off,
            'max_hours': self.max_hours,
            'max_shifts_in_a_row': self.max_shifts_in_a_row,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

class Shift(db.Model):
    __tablename__ = 'shifts'

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=True)
    start_time = db.Column(db.DateTime(timezone=True), nullable=False)
    end_time = db.Column(db.DateTime(timezone=True), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    cell_text = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), 
                          default=lambda: datetime.now(timezone.utc), 
                          onupdate=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<Shift id={self.id} start={self.start_time} cell={self.cell_text} employee_id={self.employee_id}>'

    def to_dict(self):
        employee_name = None
        employee_job_title = None
        if self.employee_id:
             emp = db.session.get(Employee, self.employee_id)
             if emp:
                 employee_name = emp.name
                 employee_job_title = emp.job_title
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee_name': employee_name,
            'employee_job_title': employee_job_title,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'notes': self.notes,
            'cell_text': self.cell_text,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    @db.validates('start_time', 'end_time')
    def validate_end_time(self, key, value):
        # Ensure the value being validated is timezone-aware
        if isinstance(value, datetime) and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        elif not isinstance(value, datetime):
             return value

        start = self.start_time
        end = self.end_time

        # Ensure existing values are aware
        if isinstance(start, datetime) and start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if isinstance(end, datetime) and end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)

        if key == 'start_time':
            start = value
        elif key == 'end_time':
            end = value

        if isinstance(start, datetime) and isinstance(end, datetime):
            if end <= start:
                raise ValueError("End time must be after start time.")
        return value

class OllamaQuery(db.Model):
    __tablename__ = 'ollama_queries'

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    query = db.Column(db.Text, nullable=False)
    response = db.Column(db.Text, nullable=False)
    model_used = db.Column(db.String(50), default='llama3:8b')
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), 
                          default=lambda: datetime.now(timezone.utc), 
                          onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee_name': self.employee.name if self.employee else None,
            'query': self.query,
            'response': self.response,
            'model_used': self.model_used,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class PolicyDocument(db.Model):
    __tablename__ = 'policy_documents'

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(20), nullable=True)
    uploaded_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    uploader_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=True)
    content = db.Column(db.Text, nullable=False)  # Raw extracted text content
    file_data = db.Column(db.LargeBinary, nullable=True)  # Original file bytes

    # New fields for document management status
    chunk_count = db.Column(db.Integer, nullable=False, default=0)
    status = db.Column(db.String(32), nullable=False, default="Pending")  # "Indexed", "Pending", "Error"
    error_message = db.Column(db.Text, nullable=True)

    uploader = db.relationship('Employee', backref='uploaded_policies', lazy=True)
    chunks = db.relationship('PolicyChunk', backref='document', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'file_type': self.file_type,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'uploader_id': self.uploader_id,
            'content_preview': self.content[:200] + '...' if self.content else '',
            'chunk_count': self.chunk_count,
            'status': self.status,
            'error_message': self.error_message,
        }

class Conversation(db.Model):
    __tablename__ = 'conversations'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=True)
    title = db.Column(db.String(255), nullable=False, default="New Chat")
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    messages = db.Column(db.JSON, nullable=False, default=list)  # List of {role, text}

    user = db.relationship('Employee', backref='conversations', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'messages': self.messages
        }

class ScheduleSnapshot(db.Model):
    __tablename__ = 'schedule_snapshots'

    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_by = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=True)
    description = db.Column(db.String(255), nullable=True)
    data = db.Column(db.LargeBinary, nullable=False)  # Pickled or JSON-encoded schedule data

    creator = db.relationship('Employee', backref='schedule_snapshots', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'created_by': self.created_by,
            'description': self.description,
        }

class PolicyChunk(db.Model):
    __tablename__ = 'policy_chunks'

    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('policy_documents.id'), nullable=False)
    chunk_text = db.Column(db.Text, nullable=False)
    embedding = db.Column(JSONB, nullable=True)  # Store embedding vector as JSON array
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'document_id': self.document_id,
            'chunk_text_preview': self.chunk_text[:200] + '...' if self.chunk_text else '',
            'embedding_dim': len(self.embedding) if self.embedding else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
