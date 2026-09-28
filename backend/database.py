from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

# ─────────────────────────────────────────────
# Core Identity Models
# ─────────────────────────────────────────────

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    role = db.Column(db.String(50), nullable=False)  # Admin, Lecturer, QA, Student
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)
    last_login = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='Active')

class NFCCard(db.Model):
    uid = db.Column(db.String(50), primary_key=True)
    status = db.Column(db.String(20), default='Active')  # Active, Inactive, Lost, Blocked
    assigned_student_uid = db.Column(db.String(50), db.ForeignKey('student.uid'), nullable=True)
    assigned_staff_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    issued_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text, nullable=True)

# ─────────────────────────────────────────────
# Academic Structure
# ─────────────────────────────────────────────

class School(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)

class Department(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    school_id = db.Column(db.Integer, db.ForeignKey('school.id'))

class Programme(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'))

class Student(db.Model):
    uid = db.Column(db.String(50), primary_key=True)
    reg_no = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120))
    programme_id = db.Column(db.Integer, db.ForeignKey('programme.id'))
    year_of_study = db.Column(db.Integer, default=1)
    status = db.Column(db.String(20), default='Active')
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    avatar = db.Column(db.Text)
    phone = db.Column(db.String(20), nullable=True)
    is_alumni = db.Column(db.Boolean, default=False)
    graduation_year = db.Column(db.Integer, nullable=True)

class Lecturer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'))
    email = db.Column(db.String(120), nullable=True)

class Unit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    credits = db.Column(db.Integer, default=3)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'))
    lecturer_id = db.Column(db.Integer, db.ForeignKey('lecturer.id'))

class Venue(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    building = db.Column(db.String(100))
    capacity = db.Column(db.Integer)
    status = db.Column(db.String(20), default='Available')
    type = db.Column(db.String(50), default='Classroom')  # Classroom, Lab, Auditorium, Exam Hall

class ClassSchedule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    unit_id = db.Column(db.Integer, db.ForeignKey('unit.id'))
    lecturer_id = db.Column(db.Integer, db.ForeignKey('lecturer.id'))
    venue_id = db.Column(db.Integer, db.ForeignKey('venue.id'))
    day_of_week = db.Column(db.String(15))
    start_time = db.Column(db.String(5))
    end_time = db.Column(db.String(5))
    semester = db.Column(db.String(20))

class ClassSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    schedule_id = db.Column(db.Integer, db.ForeignKey('class_schedule.id'))
    date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), default='Active')  # Active, Completed

class Enrollment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_uid = db.Column(db.String(50), db.ForeignKey('student.uid'))
    unit_id = db.Column(db.Integer, db.ForeignKey('unit.id'))
    enrolled_at = db.Column(db.DateTime, default=datetime.utcnow)

class AttendanceRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('class_session.id'))
    student_uid = db.Column(db.String(50), db.ForeignKey('student.uid'))
    nfc_card_uid = db.Column(db.String(50))
    tappoint_id = db.Column(db.String(50), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(50))  # Present, Rejected (Not Enrolled), Rejected (Duplicate)

# ─────────────────────────────────────────────
# TapPoint Device Registry
# ─────────────────────────────────────────────

class TapPoint(db.Model):
    id = db.Column(db.String(50), primary_key=True)  # e.g. "LAB1-READER"
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(150))
    building = db.Column(db.String(100))
    mode = db.Column(db.String(30), default='attendance')  # attendance, access, exam, library, equipment, event
    status = db.Column(db.String(20), default='Offline')   # Online, Offline, Maintenance
    venue_id = db.Column(db.Integer, db.ForeignKey('venue.id'), nullable=True)
    last_seen = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text, nullable=True)

class AccessLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    tappoint_id = db.Column(db.String(50), db.ForeignKey('tap_point.id'), nullable=True)
    card_uid = db.Column(db.String(50))
    student_uid = db.Column(db.String(50), db.ForeignKey('student.uid'), nullable=True)
    direction = db.Column(db.String(10), default='In')  # In, Out
    result = db.Column(db.String(20))  # Granted, Denied
    reason = db.Column(db.String(200), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# ─────────────────────────────────────────────
# Examination Module
# ─────────────────────────────────────────────

class Exam(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    unit_id = db.Column(db.Integer, db.ForeignKey('unit.id'))
    name = db.Column(db.String(150), nullable=False)
    exam_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.String(5))
    end_time = db.Column(db.String(5))
    venue_id = db.Column(db.Integer, db.ForeignKey('venue.id'), nullable=True)
    semester = db.Column(db.String(30))
    status = db.Column(db.String(20), default='Scheduled')  # Scheduled, Active, Completed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ExamClearance(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey('exam.id'))
    student_uid = db.Column(db.String(50), db.ForeignKey('student.uid'))
    status = db.Column(db.String(20), default='Cleared')  # Cleared, Not Cleared, Pending
    reason = db.Column(db.String(200), nullable=True)
    cleared_by = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ExamAttendanceRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey('exam.id'))
    student_uid = db.Column(db.String(50), db.ForeignKey('student.uid'), nullable=True)
    nfc_card_uid = db.Column(db.String(50))
    tappoint_id = db.Column(db.String(50), nullable=True)
    result = db.Column(db.String(30))  # Verified, Not Cleared, Not on List, Card Invalid
    reason = db.Column(db.String(200), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# ─────────────────────────────────────────────
# Library Module
# ─────────────────────────────────────────────

class LibraryMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_uid = db.Column(db.String(50), db.ForeignKey('student.uid'), unique=True)
    status = db.Column(db.String(20), default='Active')  # Active, Suspended, Expired
    expiry_date = db.Column(db.Date, nullable=True)
    registered_at = db.Column(db.DateTime, default=datetime.utcnow)

class LibraryTransaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_uid = db.Column(db.String(50), db.ForeignKey('student.uid'))
    item_name = db.Column(db.String(200))
    isbn = db.Column(db.String(30), nullable=True)
    action = db.Column(db.String(20))  # Borrow, Return, Entry
    tappoint_id = db.Column(db.String(50), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.Date, nullable=True)
    returned_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)

# ─────────────────────────────────────────────
# Equipment Module
# ─────────────────────────────────────────────

class Equipment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    category = db.Column(db.String(80))  # Camera, Laptop, Lab Equipment, etc.
    serial_no = db.Column(db.String(80), unique=True, nullable=True)
    status = db.Column(db.String(20), default='Available')  # Available, Borrowed, Maintenance, Lost
    description = db.Column(db.Text, nullable=True)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

class EquipmentBorrowing(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    equipment_id = db.Column(db.Integer, db.ForeignKey('equipment.id'))
    student_uid = db.Column(db.String(50), db.ForeignKey('student.uid'))
    tappoint_id = db.Column(db.String(50), nullable=True)
    borrowed_at = db.Column(db.DateTime, default=datetime.utcnow)
    expected_return = db.Column(db.Date, nullable=True)
    returned_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='Active')  # Active, Returned, Overdue

# ─────────────────────────────────────────────
# Events Module
# ─────────────────────────────────────────────

class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    event_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.String(5))
    end_time = db.Column(db.String(5), nullable=True)
    venue_id = db.Column(db.Integer, db.ForeignKey('venue.id'), nullable=True)
    organizer = db.Column(db.String(100), nullable=True)
    capacity = db.Column(db.Integer, nullable=True)
    status = db.Column(db.String(20), default='Upcoming')  # Upcoming, Active, Completed, Cancelled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class EventParticipation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('event.id'))
    student_uid = db.Column(db.String(50), db.ForeignKey('student.uid'), nullable=True)
    nfc_card_uid = db.Column(db.String(50))
    tappoint_id = db.Column(db.String(50), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    method = db.Column(db.String(20), default='Tap')  # Tap, Manual

# ─────────────────────────────────────────────
# Audit Log
# ─────────────────────────────────────────────

class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(255), nullable=False)
    user_id = db.Column(db.Integer, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    details = db.Column(db.Text)  # JSON string
