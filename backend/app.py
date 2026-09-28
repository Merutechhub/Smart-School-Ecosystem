from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, get_jwt
from database import (db, NFCCard, Student, AttendanceRecord, ClassSession, ClassSchedule,
                      Unit, Enrollment, Venue, Lecturer, Programme, School, Department,
                      AuditLog, TapPoint, AccessLog, Exam, ExamClearance, ExamAttendanceRecord,
                      LibraryMember, LibraryTransaction, Equipment, EquipmentBorrowing,
                      Event, EventParticipation, User)
from auth import auth_bp
import json
from datetime import datetime, date
import time
import csv
import io
import pdfplumber
import tempfile
import os

try:
    from smartcard.System import readers
    from smartcard.util import toHexString
    NFC_AVAILABLE = True
except ImportError:
    NFC_AVAILABLE = False

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///smartschool.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'smartschool-secret-key-change-in-production'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False  # Tokens don't expire for dev

db.init_app(app)
jwt = JWTManager(app)
app.register_blueprint(auth_bp)

LATEST_TAP = None

# ──────────────────────────────────────────────────────────
# Tap Handlers (one per mode)
# ──────────────────────────────────────────────────────────

def handle_attendance_tap(uid, card, student, tappoint_id):
    student_data = _student_summary(student)
    active_session = ClassSession.query.filter_by(status='Active').first()
    if not active_session:
        return {"status": "error", "message": "No active class session right now", "student": student_data}, 400

    schedule = ClassSchedule.query.get(active_session.schedule_id)
    enrollment = Enrollment.query.filter_by(student_uid=student.uid, unit_id=schedule.unit_id).first()

    if not enrollment:
        att = AttendanceRecord(session_id=active_session.id, student_uid=student.uid,
                               nfc_card_uid=uid, tappoint_id=tappoint_id, status='Rejected (Not Enrolled)')
        db.session.add(att)
        _audit('Attendance Rejected', {"reason": "Not Enrolled", "student": student.name, "uid": uid})
        db.session.commit()
        return {"status": "error", "message": "Student not enrolled in this unit", "student": student_data}, 403

    existing = AttendanceRecord.query.filter_by(session_id=active_session.id,
                                                student_uid=student.uid, status='Present').first()
    if existing:
        _audit('Attendance Rejected', {"reason": "Duplicate Tap", "student": student.name, "uid": uid})
        db.session.commit()
        return {"status": "warning", "message": "Attendance already recorded", "student": student_data}, 409

    att = AttendanceRecord(session_id=active_session.id, student_uid=student.uid,
                           nfc_card_uid=uid, tappoint_id=tappoint_id, status='Present')
    db.session.add(att)
    _audit('Attendance Recorded', {"student": student.name, "uid": uid})
    db.session.commit()

    unit = Unit.query.get(schedule.unit_id)
    return {"status": "success", "message": "Attendance recorded",
            "student": student_data, "unit": {"code": unit.code, "name": unit.name}}, 200


def handle_access_tap(uid, card, student, tappoint_id):
    student_data = _student_summary(student)
    log = AccessLog(tappoint_id=tappoint_id, card_uid=uid, student_uid=student.uid,
                    result='Granted', reason='Card validated')
    db.session.add(log)
    _audit('Campus Access Granted', {"student": student.name, "uid": uid, "tappoint": tappoint_id})
    db.session.commit()
    return {"status": "success", "message": "Access granted", "student": student_data}, 200


def handle_exam_tap(uid, card, student, tappoint_id):
    student_data = _student_summary(student)
    tp = TapPoint.query.get(tappoint_id)
    venue_id = tp.venue_id if tp else None

    active_exam = None
    if venue_id:
        today = date.today()
        active_exam = Exam.query.filter_by(status='Active', venue_id=venue_id).filter(
            Exam.exam_date == today).first()
    if not active_exam:
        active_exam = Exam.query.filter_by(status='Active').first()

    if not active_exam:
        rec = ExamAttendanceRecord(exam_id=None, student_uid=student.uid, nfc_card_uid=uid,
                                   tappoint_id=tappoint_id, result='No Active Exam',
                                   reason='No active exam found')
        db.session.add(rec)
        db.session.commit()
        return {"status": "error", "message": "No active exam at this venue", "student": student_data}, 400

    clearance = ExamClearance.query.filter_by(exam_id=active_exam.id, student_uid=student.uid).first()
    if not clearance:
        result_str = 'Not on List'
        reason = 'Student not on exam clearance list'
    elif clearance.status == 'Cleared':
        result_str = 'Verified'
        reason = 'Student cleared for this exam'
    else:
        result_str = 'Not Cleared'
        reason = clearance.reason or 'Student not cleared'

    rec = ExamAttendanceRecord(exam_id=active_exam.id, student_uid=student.uid, nfc_card_uid=uid,
                               tappoint_id=tappoint_id, result=result_str, reason=reason)
    db.session.add(rec)
    _audit('Exam Tap', {"student": student.name, "exam": active_exam.name, "result": result_str})
    db.session.commit()

    unit = Unit.query.get(active_exam.unit_id)
    status = "success" if result_str == "Verified" else "error"
    return {"status": status, "message": reason, "student": student_data,
            "exam": {"name": active_exam.name, "unit": unit.code if unit else ""},
            "clearance_result": result_str}, (200 if status == "success" else 403)


def handle_library_tap(uid, card, student, tappoint_id):
    student_data = _student_summary(student)
    member = LibraryMember.query.filter_by(student_uid=student.uid).first()
    if not member or member.status != 'Active':
        return {"status": "error", "message": "Student is not an active library member", "student": student_data}, 403

    tx = LibraryTransaction(student_uid=student.uid, item_name='Library Entry',
                            action='Entry', tappoint_id=tappoint_id)
    db.session.add(tx)
    db.session.commit()
    return {"status": "success", "message": "Library entry recorded", "student": student_data}, 200


def handle_event_tap(uid, card, student, tappoint_id):
    student_data = _student_summary(student)
    active_event = Event.query.filter_by(status='Active').first()
    if not active_event:
        return {"status": "error", "message": "No active event right now", "student": student_data}, 400

    existing = EventParticipation.query.filter_by(event_id=active_event.id, student_uid=student.uid).first()
    if existing:
        return {"status": "warning", "message": "Already registered for this event", "student": student_data}, 409

    part = EventParticipation(event_id=active_event.id, student_uid=student.uid,
                              nfc_card_uid=uid, tappoint_id=tappoint_id)
    db.session.add(part)
    _audit('Event Participation Recorded', {"student": student.name, "event": active_event.name})
    db.session.commit()
    return {"status": "success", "message": f"Registered for: {active_event.name}", "student": student_data}, 200


# ──────────────────────────────────────────────────────────
# Main Tap Endpoint (Mode Router)
# ──────────────────────────────────────────────────────────

@app.route('/api/tap', methods=['POST'])
def handle_tap():
    global LATEST_TAP
    data = request.json
    uid = data.get('uid')
    tappoint_id = data.get('tappoint_id')

    def set_latest(payload):
        payload["uid"] = uid
        payload["timestamp"] = time.time()
        LATEST_TAP = payload
        return payload

    if not uid:
        LATEST_TAP = {"status": "error", "message": "UID required", "timestamp": time.time()}
        return jsonify(LATEST_TAP), 400

    card = NFCCard.query.get(uid)
    if not card:
        return jsonify(set_latest({"status": "error", "message": "Card not registered"})), 404
    if card.status != 'Active':
        return jsonify(set_latest({"status": "error", "message": f"Card is {card.status}"})), 403

    student = Student.query.filter_by(uid=card.assigned_student_uid).first()
    if not student:
        return jsonify(set_latest({"status": "error", "message": "No student assigned to this card"})), 404

    # Update TapPoint last_seen
    if tappoint_id:
        tp = TapPoint.query.get(tappoint_id)
        if tp:
            tp.last_seen = datetime.utcnow()
            tp.status = 'Online'
            db.session.commit()

    # Determine mode
    mode = 'attendance'
    if tappoint_id:
        tp = TapPoint.query.get(tappoint_id)
        if tp:
            mode = tp.mode

    # Route to correct handler
    if mode == 'attendance':
        result, code = handle_attendance_tap(uid, card, student, tappoint_id)
    elif mode == 'access':
        result, code = handle_access_tap(uid, card, student, tappoint_id)
    elif mode == 'exam':
        result, code = handle_exam_tap(uid, card, student, tappoint_id)
    elif mode == 'library':
        result, code = handle_library_tap(uid, card, student, tappoint_id)
    elif mode == 'event':
        result, code = handle_event_tap(uid, card, student, tappoint_id)
    else:
        result, code = handle_attendance_tap(uid, card, student, tappoint_id)

    return jsonify(set_latest(result)), code


@app.route('/api/latest_tap', methods=['GET'])
def get_latest_tap():
    if LATEST_TAP:
        return jsonify(LATEST_TAP)
    return jsonify({}), 404

# ──────────────────────────────────────────────────────────
# TapPoint CRUD
# ──────────────────────────────────────────────────────────

@app.route('/api/tappoints', methods=['GET'])
def get_tappoints():
    tps = TapPoint.query.all()
    results = []
    for tp in tps:
        # Auto-mark as offline if last_seen > 60s ago
        is_online = (tp.last_seen and (datetime.utcnow() - tp.last_seen).total_seconds() < 60)
        if not is_online and tp.status == 'Online':
            tp.status = 'Offline'
        results.append({
            "id": tp.id, "name": tp.name, "location": tp.location, "building": tp.building,
            "mode": tp.mode, "status": tp.status, "venue_id": tp.venue_id,
            "last_seen": tp.last_seen.isoformat() if tp.last_seen else None,
            "notes": tp.notes
        })
    db.session.commit()
    return jsonify({"tappoints": results})

@app.route('/api/tappoints', methods=['POST'])
def create_tappoint():
    data = request.json
    if not data.get('id') or not data.get('name'):
        return jsonify({"error": "id and name are required"}), 400
    if TapPoint.query.get(data['id']):
        return jsonify({"error": "TapPoint ID already exists"}), 409
    tp = TapPoint(id=data['id'], name=data['name'], location=data.get('location'),
                  building=data.get('building'), mode=data.get('mode', 'attendance'),
                  venue_id=data.get('venue_id'), notes=data.get('notes'))
    db.session.add(tp)
    _audit('TapPoint Created', {"id": data['id'], "name": data['name'], "mode": tp.mode})
    db.session.commit()
    return jsonify({"message": "TapPoint registered", "id": tp.id}), 201

@app.route('/api/tappoints/<id>', methods=['PUT'])
def update_tappoint(id):
    tp = TapPoint.query.get(id)
    if not tp:
        return jsonify({"error": "TapPoint not found"}), 404
    data = request.json
    tp.name = data.get('name', tp.name)
    tp.location = data.get('location', tp.location)
    tp.building = data.get('building', tp.building)
    tp.mode = data.get('mode', tp.mode)
    tp.venue_id = data.get('venue_id', tp.venue_id)
    tp.notes = data.get('notes', tp.notes)
    if 'status' in data:
        tp.status = data['status']
    _audit('TapPoint Updated', {"id": id})
    db.session.commit()
    return jsonify({"message": "TapPoint updated"})

@app.route('/api/tappoints/<id>', methods=['DELETE'])
def delete_tappoint(id):
    tp = TapPoint.query.get(id)
    if not tp:
        return jsonify({"error": "TapPoint not found"}), 404
    db.session.delete(tp)
    _audit('TapPoint Deleted', {"id": id})
    db.session.commit()
    return jsonify({"message": "TapPoint deleted"})

@app.route('/api/tappoints/<id>/heartbeat', methods=['POST'])
def tappoint_heartbeat(id):
    tp = TapPoint.query.get(id)
    if not tp:
        return jsonify({"error": "TapPoint not registered"}), 404
    tp.last_seen = datetime.utcnow()
    tp.status = 'Online'
    db.session.commit()
    return jsonify({"status": "ok", "mode": tp.mode})

@app.route('/api/tappoints/<id>/logs', methods=['GET'])
def get_tappoint_logs(id):
    logs = AccessLog.query.filter_by(tappoint_id=id).order_by(AccessLog.timestamp.desc()).limit(50).all()
    results = []
    for l in logs:
        student = Student.query.get(l.student_uid) if l.student_uid else None
        results.append({
            "id": l.id, "card_uid": l.card_uid,
            "student": student.name if student else "Unknown",
            "result": l.result, "reason": l.reason,
            "timestamp": l.timestamp.isoformat()
        })
    return jsonify({"logs": results})

# ──────────────────────────────────────────────────────────
# Examination Endpoints
# ──────────────────────────────────────────────────────────

@app.route('/api/exams', methods=['GET'])
def get_exams():
    exams = Exam.query.order_by(Exam.exam_date.desc()).all()
    results = []
    for e in exams:
        unit = Unit.query.get(e.unit_id)
        venue = Venue.query.get(e.venue_id) if e.venue_id else None
        cleared = ExamClearance.query.filter_by(exam_id=e.id, status='Cleared').count()
        attended = ExamAttendanceRecord.query.filter_by(exam_id=e.id, result='Verified').count()
        results.append({
            "id": e.id, "name": e.name,
            "unit_code": unit.code if unit else "N/A",
            "unit_name": unit.name if unit else "N/A",
            "exam_date": e.exam_date.isoformat(),
            "start_time": e.start_time, "end_time": e.end_time,
            "venue": venue.name if venue else "Not Set",
            "semester": e.semester, "status": e.status,
            "cleared_count": cleared, "attended_count": attended
        })
    return jsonify({"exams": results})

@app.route('/api/exams', methods=['POST'])
def create_exam():
    data = request.json
    exam = Exam(
        unit_id=data['unit_id'], name=data['name'],
        exam_date=datetime.strptime(data['exam_date'], '%Y-%m-%d').date(),
        start_time=data.get('start_time'), end_time=data.get('end_time'),
        venue_id=data.get('venue_id'), semester=data.get('semester'),
        status=data.get('status', 'Scheduled')
    )
    db.session.add(exam)
    _audit('Exam Created', {"name": data['name']})
    db.session.commit()
    return jsonify({"message": "Exam created", "id": exam.id}), 201

@app.route('/api/exams/<int:id>', methods=['PUT'])
def update_exam(id):
    exam = Exam.query.get(id)
    if not exam:
        return jsonify({"error": "Exam not found"}), 404
    data = request.json
    exam.name = data.get('name', exam.name)
    exam.unit_id = data.get('unit_id', exam.unit_id)
    exam.venue_id = data.get('venue_id', exam.venue_id)
    exam.start_time = data.get('start_time', exam.start_time)
    exam.end_time = data.get('end_time', exam.end_time)
    exam.semester = data.get('semester', exam.semester)
    if 'exam_date' in data:
        exam.exam_date = datetime.strptime(data['exam_date'], '%Y-%m-%d').date()
    if 'status' in data:
        exam.status = data['status']
    _audit('Exam Updated', {"id": id})
    db.session.commit()
    return jsonify({"message": "Exam updated"})

@app.route('/api/exams/<int:id>/activate', methods=['POST'])
def activate_exam(id):
    exam = Exam.query.get(id)
    if not exam:
        return jsonify({"error": "Exam not found"}), 404
    # Deactivate all other exams
    Exam.query.filter_by(status='Active').update({"status": "Scheduled"})
    exam.status = 'Active'
    _audit('Exam Activated', {"id": id, "name": exam.name})
    db.session.commit()
    return jsonify({"message": f"Exam '{exam.name}' is now active"})

@app.route('/api/exams/<int:id>/complete', methods=['POST'])
def complete_exam(id):
    exam = Exam.query.get(id)
    if not exam:
        return jsonify({"error": "Exam not found"}), 404
    exam.status = 'Completed'
    _audit('Exam Completed', {"id": id})
    db.session.commit()
    return jsonify({"message": "Exam marked as completed"})

@app.route('/api/exams/<int:id>/clearance', methods=['GET'])
def get_exam_clearance(id):
    clearances = ExamClearance.query.filter_by(exam_id=id).all()
    results = []
    for c in clearances:
        student = Student.query.get(c.student_uid)
        results.append({
            "id": c.id, "student_uid": c.student_uid,
            "student_name": student.name if student else "Unknown",
            "reg_no": student.reg_no if student else "",
            "status": c.status, "reason": c.reason, "cleared_by": c.cleared_by
        })
    return jsonify({"clearance": results})

@app.route('/api/exams/<int:id>/clearance', methods=['POST'])
def add_exam_clearance(id):
    data = request.json
    student_uid = data.get('student_uid')
    reg_no = data.get('reg_no')

    if reg_no and not student_uid:
        student = Student.query.filter_by(reg_no=reg_no).first()
        if not student:
            return jsonify({"error": f"Student with reg_no {reg_no} not found"}), 404
        student_uid = student.uid

    existing = ExamClearance.query.filter_by(exam_id=id, student_uid=student_uid).first()
    if existing:
        existing.status = data.get('status', existing.status)
        existing.reason = data.get('reason', existing.reason)
    else:
        c = ExamClearance(exam_id=id, student_uid=student_uid,
                          status=data.get('status', 'Cleared'),
                          reason=data.get('reason'), cleared_by=data.get('cleared_by', 'Admin'))
        db.session.add(c)
    db.session.commit()
    return jsonify({"message": "Clearance record saved"}), 201

@app.route('/api/exams/<int:id>/clearance/bulk', methods=['POST'])
def bulk_exam_clearance(id):
    data = request.json
    reg_numbers = data.get('reg_numbers', [])
    status = data.get('status', 'Cleared')
    added, not_found = 0, []
    for reg_no in reg_numbers:
        reg_no = reg_no.strip()
        if not reg_no:
            continue
        student = Student.query.filter_by(reg_no=reg_no).first()
        if not student:
            not_found.append(reg_no)
            continue
        existing = ExamClearance.query.filter_by(exam_id=id, student_uid=student.uid).first()
        if existing:
            existing.status = status
        else:
            c = ExamClearance(exam_id=id, student_uid=student.uid, status=status, cleared_by='Bulk Import')
            db.session.add(c)
        added += 1
    _audit('Exam Clearance Bulk Import', {"exam_id": id, "added": added, "not_found": not_found})
    db.session.commit()
    return jsonify({"message": f"Added {added} clearances", "not_found": not_found})

@app.route('/api/exams/<int:id>/attendance', methods=['GET'])
def get_exam_attendance(id):
    records = ExamAttendanceRecord.query.filter_by(exam_id=id).order_by(
        ExamAttendanceRecord.timestamp.desc()).all()
    results = []
    for r in records:
        student = Student.query.get(r.student_uid) if r.student_uid else None
        results.append({
            "id": r.id,
            "student_name": student.name if student else "Unknown",
            "reg_no": student.reg_no if student else "",
            "result": r.result, "reason": r.reason,
            "timestamp": r.timestamp.isoformat()
        })
    return jsonify({"records": results})

# ──────────────────────────────────────────────────────────
# Library Endpoints
# ──────────────────────────────────────────────────────────

@app.route('/api/library/members', methods=['GET'])
def get_library_members():
    members = LibraryMember.query.all()
    results = []
    for m in members:
        student = Student.query.get(m.student_uid)
        results.append({
            "id": m.id, "student_uid": m.student_uid,
            "student_name": student.name if student else "Unknown",
            "reg_no": student.reg_no if student else "",
            "status": m.status,
            "expiry_date": m.expiry_date.isoformat() if m.expiry_date else None,
            "registered_at": m.registered_at.isoformat()
        })
    return jsonify({"members": results})

@app.route('/api/library/members', methods=['POST'])
def register_library_member():
    data = request.json
    student_uid = data.get('student_uid')
    existing = LibraryMember.query.filter_by(student_uid=student_uid).first()
    if existing:
        return jsonify({"error": "Student is already a library member"}), 409
    from datetime import date, timedelta
    expiry = date.today().replace(year=date.today().year + 1)
    m = LibraryMember(student_uid=student_uid, status='Active', expiry_date=expiry)
    db.session.add(m)
    _audit('Library Member Registered', {"student_uid": student_uid})
    db.session.commit()
    return jsonify({"message": "Library member registered"}), 201

@app.route('/api/library/members/<student_uid>', methods=['PUT'])
def update_library_member(student_uid):
    m = LibraryMember.query.filter_by(student_uid=student_uid).first()
    if not m:
        return jsonify({"error": "Member not found"}), 404
    data = request.json
    m.status = data.get('status', m.status)
    if 'expiry_date' in data:
        m.expiry_date = datetime.strptime(data['expiry_date'], '%Y-%m-%d').date()
    db.session.commit()
    return jsonify({"message": "Member updated"})

@app.route('/api/library/transactions', methods=['GET'])
def get_library_transactions():
    txs = LibraryTransaction.query.order_by(LibraryTransaction.timestamp.desc()).limit(100).all()
    results = []
    for t in txs:
        student = Student.query.get(t.student_uid)
        results.append({
            "id": t.id,
            "student_name": student.name if student else "Unknown",
            "reg_no": student.reg_no if student else "",
            "item_name": t.item_name, "isbn": t.isbn, "action": t.action,
            "timestamp": t.timestamp.isoformat(),
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "returned_at": t.returned_at.isoformat() if t.returned_at else None
        })
    return jsonify({"transactions": results})

@app.route('/api/library/borrow', methods=['POST'])
def library_borrow():
    data = request.json
    from datetime import date, timedelta
    tx = LibraryTransaction(
        student_uid=data['student_uid'],
        item_name=data.get('item_name', 'Unknown Item'),
        isbn=data.get('isbn'),
        action='Borrow',
        due_date=date.today() + timedelta(days=14)
    )
    db.session.add(tx)
    db.session.commit()
    return jsonify({"message": "Borrow recorded", "due_date": tx.due_date.isoformat()}), 201

@app.route('/api/library/return/<int:tx_id>', methods=['POST'])
def library_return(tx_id):
    tx = LibraryTransaction.query.get(tx_id)
    if not tx:
        return jsonify({"error": "Transaction not found"}), 404
    tx.returned_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"message": "Return recorded"})

# ──────────────────────────────────────────────────────────
# Equipment Endpoints
# ──────────────────────────────────────────────────────────

@app.route('/api/equipment', methods=['GET'])
def get_equipment():
    items = Equipment.query.all()
    results = []
    for e in items:
        active = EquipmentBorrowing.query.filter_by(equipment_id=e.id, status='Active').first()
        borrower = None
        if active:
            s = Student.query.get(active.student_uid)
            borrower = {"name": s.name if s else "Unknown", "reg_no": s.reg_no if s else "",
                        "due": active.expected_return.isoformat() if active.expected_return else None}
        results.append({
            "id": e.id, "name": e.name, "category": e.category,
            "serial_no": e.serial_no, "status": e.status,
            "description": e.description, "current_borrower": borrower
        })
    return jsonify({"equipment": results})

@app.route('/api/equipment', methods=['POST'])
def add_equipment():
    data = request.json
    eq = Equipment(name=data['name'], category=data.get('category'),
                   serial_no=data.get('serial_no'), description=data.get('description'))
    db.session.add(eq)
    _audit('Equipment Added', {"name": data['name']})
    db.session.commit()
    return jsonify({"message": "Equipment added", "id": eq.id}), 201

@app.route('/api/equipment/<int:id>', methods=['PUT'])
def update_equipment(id):
    eq = Equipment.query.get(id)
    if not eq:
        return jsonify({"error": "Equipment not found"}), 404
    data = request.json
    eq.name = data.get('name', eq.name)
    eq.category = data.get('category', eq.category)
    eq.status = data.get('status', eq.status)
    eq.description = data.get('description', eq.description)
    db.session.commit()
    return jsonify({"message": "Equipment updated"})

@app.route('/api/equipment/borrowings', methods=['GET'])
def get_borrowings():
    borrowings = EquipmentBorrowing.query.filter_by(status='Active').all()
    results = []
    for b in borrowings:
        eq = Equipment.query.get(b.equipment_id)
        student = Student.query.get(b.student_uid)
        results.append({
            "id": b.id,
            "equipment_name": eq.name if eq else "Unknown",
            "student_name": student.name if student else "Unknown",
            "reg_no": student.reg_no if student else "",
            "borrowed_at": b.borrowed_at.isoformat(),
            "expected_return": b.expected_return.isoformat() if b.expected_return else None,
            "status": b.status
        })
    return jsonify({"borrowings": results})

@app.route('/api/equipment/<int:id>/borrow', methods=['POST'])
def borrow_equipment(id):
    data = request.json
    eq = Equipment.query.get(id)
    if not eq:
        return jsonify({"error": "Equipment not found"}), 404
    if eq.status != 'Available':
        return jsonify({"error": f"Equipment is currently {eq.status}"}), 409
    from datetime import date, timedelta
    days = data.get('days', 3)
    b = EquipmentBorrowing(equipment_id=id, student_uid=data['student_uid'],
                           expected_return=date.today() + timedelta(days=days))
    eq.status = 'Borrowed'
    db.session.add(b)
    _audit('Equipment Borrowed', {"equipment": eq.name, "student_uid": data['student_uid']})
    db.session.commit()
    return jsonify({"message": "Equipment borrowed", "due": b.expected_return.isoformat()}), 201

@app.route('/api/equipment/borrowings/<int:id>/return', methods=['POST'])
def return_equipment(id):
    b = EquipmentBorrowing.query.get(id)
    if not b:
        return jsonify({"error": "Borrowing record not found"}), 404
    b.returned_at = datetime.utcnow()
    b.status = 'Returned'
    eq = Equipment.query.get(b.equipment_id)
    if eq:
        eq.status = 'Available'
    _audit('Equipment Returned', {"borrowing_id": id})
    db.session.commit()
    return jsonify({"message": "Equipment returned successfully"})

# ──────────────────────────────────────────────────────────
# Events Endpoints
# ──────────────────────────────────────────────────────────

@app.route('/api/events', methods=['GET'])
def get_events():
    events = Event.query.order_by(Event.event_date.desc()).all()
    results = []
    for e in events:
        venue = Venue.query.get(e.venue_id) if e.venue_id else None
        count = EventParticipation.query.filter_by(event_id=e.id).count()
        results.append({
            "id": e.id, "name": e.name, "description": e.description,
            "event_date": e.event_date.isoformat(),
            "start_time": e.start_time, "end_time": e.end_time,
            "venue": venue.name if venue else "TBD",
            "organizer": e.organizer, "capacity": e.capacity,
            "status": e.status, "participant_count": count
        })
    return jsonify({"events": results})

@app.route('/api/events', methods=['POST'])
def create_event():
    data = request.json
    ev = Event(
        name=data['name'], description=data.get('description'),
        event_date=datetime.strptime(data['event_date'], '%Y-%m-%d').date(),
        start_time=data.get('start_time'), end_time=data.get('end_time'),
        venue_id=data.get('venue_id'), organizer=data.get('organizer'),
        capacity=data.get('capacity'), status=data.get('status', 'Upcoming')
    )
    db.session.add(ev)
    _audit('Event Created', {"name": data['name']})
    db.session.commit()
    return jsonify({"message": "Event created", "id": ev.id}), 201

@app.route('/api/events/<int:id>', methods=['PUT'])
def update_event(id):
    ev = Event.query.get(id)
    if not ev:
        return jsonify({"error": "Event not found"}), 404
    data = request.json
    ev.name = data.get('name', ev.name)
    ev.description = data.get('description', ev.description)
    ev.organizer = data.get('organizer', ev.organizer)
    ev.capacity = data.get('capacity', ev.capacity)
    ev.venue_id = data.get('venue_id', ev.venue_id)
    ev.start_time = data.get('start_time', ev.start_time)
    ev.end_time = data.get('end_time', ev.end_time)
    if 'event_date' in data:
        ev.event_date = datetime.strptime(data['event_date'], '%Y-%m-%d').date()
    if 'status' in data:
        ev.status = data['status']
    db.session.commit()
    return jsonify({"message": "Event updated"})

@app.route('/api/events/<int:id>/activate', methods=['POST'])
def activate_event(id):
    ev = Event.query.get(id)
    if not ev:
        return jsonify({"error": "Event not found"}), 404
    Event.query.filter_by(status='Active').update({"status": "Upcoming"})
    ev.status = 'Active'
    _audit('Event Activated', {"id": id, "name": ev.name})
    db.session.commit()
    return jsonify({"message": f"Event '{ev.name}' is now active"})

@app.route('/api/events/<int:id>/participants', methods=['GET'])
def get_event_participants(id):
    parts = EventParticipation.query.filter_by(event_id=id).order_by(
        EventParticipation.timestamp.desc()).all()
    results = []
    for p in parts:
        student = Student.query.get(p.student_uid) if p.student_uid else None
        results.append({
            "id": p.id,
            "student_name": student.name if student else "Unknown",
            "reg_no": student.reg_no if student else "",
            "timestamp": p.timestamp.isoformat(), "method": p.method
        })
    return jsonify({"participants": results, "count": len(results)})

@app.route('/api/events/<int:id>/participants', methods=['POST'])
def add_event_participant(id):
    data = request.json
    student_uid = data.get('student_uid')
    existing = EventParticipation.query.filter_by(event_id=id, student_uid=student_uid).first()
    if existing:
        return jsonify({"error": "Already registered"}), 409
    p = EventParticipation(event_id=id, student_uid=student_uid,
                           nfc_card_uid='', method='Manual')
    db.session.add(p)
    db.session.commit()
    return jsonify({"message": "Participant added"}), 201

# ──────────────────────────────────────────────────────────
# Enrollment Endpoints
# ──────────────────────────────────────────────────────────

@app.route('/api/academic/units/<int:unit_id>/enrollments', methods=['GET'])
def get_unit_enrollments(unit_id):
    unit = Unit.query.get(unit_id)
    if not unit:
        return jsonify({"error": "Unit not found"}), 404
    enrollments = Enrollment.query.filter_by(unit_id=unit_id).all()
    results = []
    for e in enrollments:
        student = Student.query.get(e.student_uid)
        if student:
            results.append({
                "enrollment_id": e.id,
                "student_uid": student.uid,
                "name": student.name,
                "reg_no": student.reg_no,
                "year_of_study": student.year_of_study,
                "enrolled_at": e.enrolled_at.isoformat() if e.enrolled_at else None
            })
    return jsonify({"unit": {"id": unit.id, "code": unit.code, "name": unit.name},
                    "enrollments": results, "count": len(results)})

@app.route('/api/academic/units/<int:unit_id>/enroll', methods=['POST'])
def enroll_student(unit_id):
    data = request.json
    reg_no = data.get('reg_no')
    student_uid = data.get('student_uid')

    if reg_no:
        student = Student.query.filter_by(reg_no=reg_no).first()
        if not student:
            return jsonify({"error": f"Student '{reg_no}' not found"}), 404
        student_uid = student.uid

    if Enrollment.query.filter_by(unit_id=unit_id, student_uid=student_uid).first():
        return jsonify({"error": "Student already enrolled in this unit"}), 409

    e = Enrollment(student_uid=student_uid, unit_id=unit_id)
    db.session.add(e)
    _audit('Student Enrolled', {"unit_id": unit_id, "student_uid": student_uid})
    db.session.commit()
    return jsonify({"message": "Student enrolled"}), 201

@app.route('/api/academic/units/<int:unit_id>/enroll/<student_uid>', methods=['DELETE'])
def unenroll_student(unit_id, student_uid):
    e = Enrollment.query.filter_by(unit_id=unit_id, student_uid=student_uid).first()
    if not e:
        return jsonify({"error": "Enrollment not found"}), 404
    db.session.delete(e)
    _audit('Student Unenrolled', {"unit_id": unit_id, "student_uid": student_uid})
    db.session.commit()
    return jsonify({"message": "Student removed from unit"})

@app.route('/api/academic/units/<int:unit_id>/enroll/bulk', methods=['POST'])
def bulk_enroll(unit_id):
    data = request.json
    reg_numbers = data.get('reg_numbers', [])
    added, not_found, already_enrolled = 0, [], []
    for reg_no in reg_numbers:
        reg_no = reg_no.strip()
        if not reg_no:
            continue
        student = Student.query.filter_by(reg_no=reg_no).first()
        if not student:
            not_found.append(reg_no)
            continue
        if Enrollment.query.filter_by(unit_id=unit_id, student_uid=student.uid).first():
            already_enrolled.append(reg_no)
            continue
        db.session.add(Enrollment(student_uid=student.uid, unit_id=unit_id))
        added += 1
    _audit('Bulk Enrollment', {"unit_id": unit_id, "added": added})
    db.session.commit()
    return jsonify({"message": f"{added} students enrolled",
                    "not_found": not_found, "already_enrolled": already_enrolled})

# ──────────────────────────────────────────────────────────
# Existing Endpoints (unchanged logic, cleaned up)
# ──────────────────────────────────────────────────────────

@app.route('/api/lecturer/sessions/start', methods=['POST'])
def start_session():
    data = request.json
    schedule_id = data.get('schedule_id')
    if not schedule_id:
        return jsonify({"error": "schedule_id required"}), 400
    if ClassSession.query.filter_by(status='Active').first():
        return jsonify({"error": "A session is already active. End it first."}), 400
    session = ClassSession(schedule_id=schedule_id, status='Active', date=datetime.utcnow().date())
    db.session.add(session)
    _audit('Class Session Started', {"schedule_id": schedule_id})
    db.session.commit()
    return jsonify({"message": "Session started", "session_id": session.id})

@app.route('/api/lecturer/sessions/end', methods=['POST'])
def end_session():
    sessions = ClassSession.query.filter_by(status='Active').all()
    ended_ids = []
    for s in sessions:
        s.status = 'Completed'
        ended_ids.append(s.id)
        _audit('Class Session Ended', {"session_id": s.id})
    db.session.commit()
    return jsonify({"message": "Active sessions ended", "ended_session_ids": ended_ids})

@app.route('/api/sessions/<int:session_id>/attendance', methods=['GET'])
def get_session_attendance(session_id):
    """Return full attendance data for a completed session (for export)."""
    session = ClassSession.query.get(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    schedule = ClassSchedule.query.get(session.schedule_id)
    unit = Unit.query.get(schedule.unit_id) if schedule else None
    venue = Venue.query.get(schedule.venue_id) if schedule else None
    lecturer = Lecturer.query.get(schedule.lecturer_id) if schedule else None

    # All enrolled students for this unit
    enrollments = Enrollment.query.filter_by(unit_id=unit.id).all() if unit else []
    enrolled_uids = {e.student_uid for e in enrollments}

    # Attendance records for this session
    records = AttendanceRecord.query.filter_by(session_id=session_id).all()
    present_uids = {r.student_uid for r in records if r.status == 'Present'}

    students_data = []
    for uid in enrolled_uids:
        student = Student.query.get(uid)
        if not student:
            continue
        tap_time = None
        for r in records:
            if r.student_uid == uid and r.status == 'Present':
                tap_time = r.timestamp.strftime('%H:%M:%S')
                break
        students_data.append({
            "reg_no": student.reg_no,
            "name": student.name,
            "year_of_study": student.year_of_study,
            "status": "Present" if uid in present_uids else "Absent",
            "tap_time": tap_time or "—"
        })

    students_data.sort(key=lambda x: x['reg_no'])

    fmt = request.args.get('format', 'json')
    if fmt == 'csv':
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Reg No', 'Name', 'Year', 'Status', 'Tap Time'])
        for s in students_data:
            writer.writerow([s['reg_no'], s['name'], s['year_of_study'], s['status'], s['tap_time']])
        csv_data = output.getvalue()
        from flask import Response
        unit_code = unit.code if unit else 'session'
        filename = f"attendance_{unit_code}_{session.date}.csv"
        return Response(csv_data, mimetype='text/csv',
                        headers={'Content-Disposition': f'attachment; filename={filename}'})

    return jsonify({
        "session_id": session_id,
        "date": session.date.isoformat(),
        "status": session.status,
        "unit_code": unit.code if unit else "N/A",
        "unit_name": unit.name if unit else "N/A",
        "venue": venue.name if venue else "N/A",
        "lecturer": lecturer.name if lecturer else "N/A",
        "present_count": len(present_uids),
        "total_enrolled": len(enrolled_uids),
        "students": students_data
    })

@app.route('/api/sessions/completed', methods=['GET'])
def get_completed_sessions():
    """Return list of all completed sessions with summary info."""
    sessions = ClassSession.query.filter_by(status='Completed').order_by(ClassSession.date.desc()).limit(100).all()
    result = []
    for sess in sessions:
        schedule = ClassSchedule.query.get(sess.schedule_id)
        unit = Unit.query.get(schedule.unit_id) if schedule else None
        lecturer = Lecturer.query.get(schedule.lecturer_id) if schedule else None
        venue = Venue.query.get(schedule.venue_id) if schedule else None
        enrolled = Enrollment.query.filter_by(unit_id=unit.id).count() if unit else 0
        present = AttendanceRecord.query.filter_by(session_id=sess.id, status='Present').count()
        pct = round((present / enrolled) * 100) if enrolled > 0 else 0
        result.append({
            "session_id": sess.id,
            "date": sess.date.isoformat(),
            "unit_code": unit.code if unit else "N/A",
            "unit_name": unit.name if unit else "N/A",
            "lecturer": lecturer.name if lecturer else "N/A",
            "venue": venue.name if venue else "N/A",
            "present": present,
            "enrolled": enrolled,
            "attendance_pct": pct
        })
    return jsonify({"sessions": result})

@app.route('/api/lecturer/sessions/active', methods=['GET'])
def get_active_session():
    active = ClassSession.query.filter_by(status='Active').first()
    if active:
        return jsonify({"active": True, "schedule_id": active.schedule_id})
    return jsonify({"active": False})

@app.route('/api/live-attendance', methods=['GET'])
def live_attendance():
    active_session = ClassSession.query.filter_by(status='Active').first()
    if not active_session:
        return jsonify({"records": []})
    records = AttendanceRecord.query.filter_by(session_id=active_session.id).order_by(
        AttendanceRecord.timestamp.desc()).all()
    results = []
    for r in records:
        student = Student.query.get(r.student_uid)
        results.append({"id": r.id, "student_name": student.name if student else "Unknown",
                        "reg_no": student.reg_no if student else "",
                        "timestamp": r.timestamp.isoformat(), "status": r.status})
    return jsonify({"records": results})

@app.route('/api/student/<uid>', methods=['GET'])
def get_student(uid):
    student = Student.query.get(uid)
    if not student:
        return jsonify({"error": "Student not found"}), 404
    card = NFCCard.query.filter_by(assigned_student_uid=uid).first()
    p = Programme.query.get(student.programme_id)
    enrollments = Enrollment.query.filter_by(student_uid=uid).all()
    units = []
    for e in enrollments:
        u = Unit.query.get(e.unit_id)
        if not u:
            continue
        schedules = ClassSchedule.query.filter_by(unit_id=u.id).all()
        sched_ids = [s.id for s in schedules]
        sessions = ClassSession.query.filter(ClassSession.schedule_id.in_(sched_ids)).all()
        sess_ids = [s.id for s in sessions]
        total_sessions = len(sess_ids)
        if total_sessions > 0:
            present = AttendanceRecord.query.filter(
                AttendanceRecord.session_id.in_(sess_ids),
                AttendanceRecord.student_uid == uid,
                AttendanceRecord.status == 'Present').count()
            attendance_percent = round((present / total_sessions) * 100)
        else:
            attendance_percent = 100
        units.append({"code": u.code, "name": u.name, "attendance": attendance_percent})
    return jsonify({"uid": student.uid, "name": student.name, "reg_no": student.reg_no,
                    "email": student.email, "year_of_study": student.year_of_study,
                    "status": student.status, "avatar": student.avatar,
                    "programme_id": student.programme_id,
                    "programme": p.name if p else "N/A",
                    "card_uid": card.uid if card else None,
                    "card_status": card.status if card else "Not Assigned",
                    "units": units})

@app.route('/api/lecturer/<int:id>/classes', methods=['GET'])
def get_lecturer_classes(id):
    schedules = ClassSchedule.query.filter_by(lecturer_id=id).all()
    classes = []
    for s in schedules:
        u = Unit.query.get(s.unit_id)
        v = Venue.query.get(s.venue_id)
        enrolled = Enrollment.query.filter_by(unit_id=u.id).count()
        sessions = ClassSession.query.filter_by(schedule_id=s.id, status='Completed').all()
        sess_ids = [sess.id for sess in sessions]
        avg_attendance = 100
        if sess_ids and enrolled > 0:
            present = AttendanceRecord.query.filter(
                AttendanceRecord.session_id.in_(sess_ids),
                AttendanceRecord.status == 'Present').count()
            avg_attendance = round((present / (len(sess_ids) * enrolled)) * 100)
        classes.append({"id": s.id, "unit_code": u.code, "unit_name": u.name,
                        "venue": v.name if v else "N/A", "day": s.day_of_week,
                        "time": f"{s.start_time} - {s.end_time}",
                        "enrolled_count": enrolled, "avg_attendance": avg_attendance})
    return jsonify({"classes": classes})

@app.route('/api/lecturer/<int:id>/stats', methods=['GET'])
def get_lecturer_stats(id):
    schedules = ClassSchedule.query.filter_by(lecturer_id=id).all()
    unit_ids = list(set([s.unit_id for s in schedules]))
    unique_students = 0
    if unit_ids:
        enrollments = Enrollment.query.filter(Enrollment.unit_id.in_(unit_ids)).all()
        unique_students = len(set([e.student_uid for e in enrollments]))
    sched_ids = [s.id for s in schedules]
    sessions = ClassSession.query.filter(ClassSession.schedule_id.in_(sched_ids),
                                         ClassSession.status == 'Completed').all()
    sess_ids = [sess.id for sess in sessions]
    avg_attendance = 100
    if sess_ids:
        total_expected, present = 0, 0
        for sess in sessions:
            sched = ClassSchedule.query.get(sess.schedule_id)
            total_expected += Enrollment.query.filter_by(unit_id=sched.unit_id).count()
        if total_expected > 0:
            present = AttendanceRecord.query.filter(
                AttendanceRecord.session_id.in_(sess_ids),
                AttendanceRecord.status == 'Present').count()
            avg_attendance = round((present / total_expected) * 100)
    return jsonify({"total_classes": len(schedules), "total_students": unique_students,
                    "avg_attendance": avg_attendance})

@app.route('/api/lecturer/classes/<int:schedule_id>/details', methods=['GET'])
def get_class_details(schedule_id):
    schedule = ClassSchedule.query.get(schedule_id)
    if not schedule:
        return jsonify({"error": "Schedule not found"}), 404
    unit = Unit.query.get(schedule.unit_id)
    venue = Venue.query.get(schedule.venue_id)
    enrollments = Enrollment.query.filter_by(unit_id=unit.id).all()
    enrolled_students, student_uids = [], []
    for e in enrollments:
        student = Student.query.get(e.student_uid)
        if student:
            student_uids.append(student.uid)
            enrolled_students.append({"uid": student.uid, "name": student.name,
                                       "reg_no": student.reg_no, "year_of_study": student.year_of_study})
    sessions_db = ClassSession.query.filter_by(schedule_id=schedule_id, status='Completed').order_by(
        ClassSession.date.desc()).all()
    sessions = []
    for sess in sessions_db:
        records = AttendanceRecord.query.filter_by(session_id=sess.id, status='Present').all()
        present_uids = [r.student_uid for r in records]
        attendance_data = []
        for stu_uid in student_uids:
            student = Student.query.get(stu_uid)
            if student:
                attendance_data.append({"student_name": student.name, "reg_no": student.reg_no,
                                         "status": "Present" if stu_uid in present_uids else "Absent"})
        sessions.append({"id": sess.id, "date": sess.date.isoformat(),
                         "present_count": len(present_uids), "total_expected": len(student_uids),
                         "attendance": attendance_data})
    return jsonify({"class_info": {"unit_code": unit.code, "unit_name": unit.name,
                                    "venue": venue.name if venue else "N/A",
                                    "day": schedule.day_of_week,
                                    "time": f"{schedule.start_time} - {schedule.end_time}",
                                    "semester": schedule.semester},
                    "enrolled_students": enrolled_students, "historical_sessions": sessions})

@app.route('/api/admin/students', methods=['GET'])
def get_all_students():
    students = Student.query.all()
    results = []
    for s in students:
        p = Programme.query.get(s.programme_id)
        card = NFCCard.query.filter_by(assigned_student_uid=s.uid).first()
        results.append({"uid": s.uid, "name": s.name, "reg_no": s.reg_no, "email": s.email,
                        "year_of_study": s.year_of_study, "programme_id": s.programme_id,
                        "programme": p.name if p else "N/A",
                        "card_uid": card.uid if card else None, "status": s.status})
    return jsonify({"students": results})

@app.route('/api/admin/students', methods=['POST'])
def create_student():
    data = request.json
    if not data.get('name') or not data.get('reg_no'):
        return jsonify({"error": "Name and Registration Number are required"}), 400
    if Student.query.filter_by(reg_no=data['reg_no']).first():
        return jsonify({"error": "Registration Number already exists"}), 409
    import uuid
    new_uid = f"STU-{str(uuid.uuid4())[:8].upper()}"
    student = Student(uid=new_uid, name=data['name'], reg_no=data['reg_no'],
                      email=data.get('email'), programme_id=data.get('programme_id'),
                      year_of_study=data.get('year_of_study', 1),
                      status=data.get('status', 'Active'), avatar=data.get('avatar'))
    db.session.add(student)
    linked_nfc = None
    if data.get('nfc_card_uid'):
        card = NFCCard.query.get(data['nfc_card_uid'])
        if card:
            card.assigned_student_uid = new_uid
            card.status = 'Active'
        else:
            card = NFCCard(uid=data['nfc_card_uid'], assigned_student_uid=new_uid, status='Active')
            db.session.add(card)
        linked_nfc = data['nfc_card_uid']
    _audit('Student Created', {"uid": new_uid, "name": data['name'], "linked_card": linked_nfc})
    db.session.commit()
    return jsonify({"message": "Student created successfully", "uid": new_uid}), 201

@app.route('/api/admin/students/<uid>', methods=['PUT'])
def update_student(uid):
    student = Student.query.get(uid)
    if not student:
        return jsonify({"error": "Student not found"}), 404
    data = request.json
    if 'reg_no' in data and data['reg_no'] != student.reg_no:
        if Student.query.filter_by(reg_no=data['reg_no']).first():
            return jsonify({"error": "Registration Number already exists"}), 409
    student.name = data.get('name', student.name)
    student.reg_no = data.get('reg_no', student.reg_no)
    student.email = data.get('email', student.email)
    student.programme_id = data.get('programme_id', student.programme_id)
    student.year_of_study = data.get('year_of_study', student.year_of_study)
    student.status = data.get('status', student.status)
    if 'avatar' in data:
        student.avatar = data['avatar']
    if 'nfc_card_uid' in data and data['nfc_card_uid']:
        card = NFCCard.query.get(data['nfc_card_uid'])
        if card:
            card.assigned_student_uid = uid
            card.status = 'Active'
        else:
            card = NFCCard(uid=data['nfc_card_uid'], assigned_student_uid=uid, status='Active')
            db.session.add(card)
    _audit('Student Updated', {"uid": uid, "name": student.name})
    db.session.commit()
    return jsonify({"message": "Student updated successfully"})

@app.route('/api/admin/students/<uid>', methods=['DELETE'])
def delete_student(uid):
    student = Student.query.get(uid)
    if not student:
        return jsonify({"error": "Student not found"}), 404
    student.status = 'Inactive'
    _audit('Student Soft Deleted', {"uid": uid, "name": student.name})
    db.session.commit()
    return jsonify({"message": "Student marked as inactive"})

@app.route('/api/academic/programmes', methods=['GET'])
def get_programmes():
    programmes = Programme.query.all()
    return jsonify({"programmes": [{"id": p.id, "name": p.name} for p in programmes]})

@app.route('/api/academic/structure', methods=['GET'])
def get_academic_structure():
    schools = School.query.all()
    structure = []
    for school in schools:
        depts_data = []
        for dept in Department.query.filter_by(school_id=school.id).all():
            progs_data = [{"id": p.id, "name": p.name}
                          for p in Programme.query.filter_by(department_id=dept.id).all()]
            units_data = [{"id": u.id, "code": u.code, "name": u.name}
                          for u in Unit.query.filter_by(department_id=dept.id).all()]
            depts_data.append({"id": dept.id, "name": dept.name,
                                "programmes": progs_data, "units": units_data})
        structure.append({"id": school.id, "name": school.name, "departments": depts_data})
    return jsonify({"structure": structure})

@app.route('/api/academic/schedules', methods=['GET'])
def get_all_schedules():
    schedules = ClassSchedule.query.all()
    results = []
    for s in schedules:
        unit = Unit.query.get(s.unit_id)
        lecturer = Lecturer.query.get(s.lecturer_id)
        venue = Venue.query.get(s.venue_id)
        results.append({"id": s.id,
                        "unit": f"{unit.code} - {unit.name}" if unit else "Unknown",
                        "unit_id": s.unit_id,
                        "lecturer": lecturer.name if lecturer else "Unknown",
                        "lecturer_id": s.lecturer_id,
                        "venue": venue.name if venue else "Unknown",
                        "venue_id": s.venue_id, "day": s.day_of_week,
                        "time": f"{s.start_time} - {s.end_time}",
                        "start_time": s.start_time, "end_time": s.end_time,
                        "semester": s.semester})
    return jsonify({"schedules": results})

@app.route('/api/academic/schedules', methods=['POST'])
def create_schedule():
    data = request.json
    try:
        s = ClassSchedule(unit_id=data['unit_id'], lecturer_id=data['lecturer_id'],
                          venue_id=data['venue_id'], day_of_week=data['day_of_week'],
                          start_time=data['start_time'], end_time=data['end_time'],
                          semester=data['semester'])
        db.session.add(s)
        _audit('Schedule Created', {"unit_id": data['unit_id']})
        db.session.commit()
        return jsonify({"message": "Schedule created"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/academic/schedules/<int:id>', methods=['PUT'])
def update_schedule(id):
    s = ClassSchedule.query.get(id)
    if not s:
        return jsonify({"error": "Schedule not found"}), 404
    data = request.json
    s.unit_id = data.get('unit_id', s.unit_id)
    s.lecturer_id = data.get('lecturer_id', s.lecturer_id)
    s.venue_id = data.get('venue_id', s.venue_id)
    s.day_of_week = data.get('day_of_week', s.day_of_week)
    s.start_time = data.get('start_time', s.start_time)
    s.end_time = data.get('end_time', s.end_time)
    s.semester = data.get('semester', s.semester)
    _audit('Schedule Updated', {"schedule_id": id})
    db.session.commit()
    return jsonify({"message": "Schedule updated"})

@app.route('/api/academic/schedules/<int:id>', methods=['DELETE'])
def delete_schedule(id):
    s = ClassSchedule.query.get(id)
    if not s:
        return jsonify({"error": "Schedule not found"}), 404
    db.session.delete(s)
    _audit('Schedule Deleted', {"schedule_id": id})
    db.session.commit()
    return jsonify({"message": "Schedule deleted"})

@app.route('/api/academic/lecturers', methods=['GET'])
def get_lecturers():
    lecturers = Lecturer.query.all()
    return jsonify({"lecturers": [{"id": l.id, "name": l.name, "department_id": l.department_id}
                                  for l in lecturers]})

@app.route('/api/academic/venues', methods=['GET'])
def get_venues():
    venues = Venue.query.all()
    return jsonify({"venues": [{"id": v.id, "name": v.name, "building": v.building,
                                "capacity": v.capacity} for v in venues]})

@app.route('/api/academic/units', methods=['GET'])
def get_units():
    units = Unit.query.all()
    return jsonify({"units": [{"id": u.id, "code": u.code, "name": u.name,
                               "department_id": u.department_id} for u in units]})

@app.route('/api/admin/audit', methods=['GET'])
def get_audit_logs():
    logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).limit(100).all()
    results = [{"id": l.id, "action": l.action, "user_id": l.user_id,
                "timestamp": l.timestamp.isoformat(), "details": l.details} for l in logs]
    return jsonify({"logs": results})

@app.route('/api/nfc/scan', methods=['GET'])
def scan_nfc():
    if not NFC_AVAILABLE:
        return jsonify({"error": "NFC library (pyscard) not installed"}), 501
    try:
        r = readers()
        if not r:
            return jsonify({"error": "No NFC reader found"}), 404
        start_time = time.time()
        while (time.time() - start_time) < 5.0:
            for reader in r:
                try:
                    conn = reader.createConnection()
                    conn.connect()
                    data, sw1, sw2 = conn.transmit([0xFF, 0xCA, 0x00, 0x00, 0x00])
                    if sw1 == 0x90:
                        return jsonify({"status": "success", "uid": "".join(f"{b:02X}" for b in data)})
                except Exception:
                    pass
            time.sleep(0.5)
        return jsonify({"error": "Timeout: No card tapped"}), 408
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    student_count = Student.query.count()
    card_count = NFCCard.query.filter(NFCCard.assigned_student_uid != None).count()
    lecturer_count = Lecturer.query.count()
    unit_count = Unit.query.count()
    tappoint_count = TapPoint.query.count()
    online_tappoints = TapPoint.query.filter_by(status='Online').count()

    active_sessions_db = ClassSession.query.filter_by(status='Active').all()
    active_sessions = []
    for session in active_sessions_db:
        schedule = ClassSchedule.query.get(session.schedule_id)
        unit = Unit.query.get(schedule.unit_id)
        lecturer = Lecturer.query.get(schedule.lecturer_id)
        venue = Venue.query.get(schedule.venue_id)
        attendance_count = AttendanceRecord.query.filter_by(session_id=session.id, status='Present').count()
        total_enrolled = Enrollment.query.filter_by(unit_id=unit.id).count()
        active_sessions.append({"id": session.id, "unit_code": unit.code, "unit_name": unit.name,
                                 "venue": venue.name if venue else "N/A",
                                 "lecturer": lecturer.name if lecturer else "N/A",
                                 "attendance_count": attendance_count,
                                 "total_enrolled": total_enrolled or 60})
    return jsonify({"students": student_count, "cards": card_count, "lecturers": lecturer_count,
                    "units": unit_count, "tappoints": tappoint_count,
                    "online_tappoints": online_tappoints,
                    "active_classes": active_sessions})

# ──────────────────────────────────────────────────────────
# QA Module
# ──────────────────────────────────────────────────────────

@app.route('/api/qa/untaught_classes', methods=['GET'])
def qa_untaught_classes():
    schedules = ClassSchedule.query.all()
    untaught = []
    for sched in schedules:
        sessions = ClassSession.query.filter_by(schedule_id=sched.id).all()
        if not sessions:
            unit = Unit.query.get(sched.unit_id)
            lecturer = Lecturer.query.get(sched.lecturer_id)
            venue = Venue.query.get(sched.venue_id)
            untaught.append({
                "id": sched.id,
                "unit_code": unit.code if unit else "N/A",
                "unit_name": unit.name if unit else "N/A",
                "lecturer": lecturer.name if lecturer else "N/A",
                "venue": venue.name if venue else "N/A",
                "day_of_week": sched.day_of_week,
                "time": f"{sched.start_time} - {sched.end_time}",
                "status": "Not Taught"
            })
    return jsonify({"untaught": untaught})

@app.route('/api/qa/reports', methods=['GET'])
def qa_reports():
    period = request.args.get('period', 'weekly')
    total_schedules = ClassSchedule.query.count()
    total_sessions = ClassSession.query.count()
    total_untaught = total_schedules - total_sessions
    
    labels, data = [], []
    if period == 'daily':
        labels, data = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], [95, 92, 88, 91, 85]
        multiplier = 1
    elif period == 'weekly':
        labels, data = ['Week 1', 'Week 2', 'Week 3', 'Week 4'], [88, 90, 85, 92]
        multiplier = 5
    elif period == 'monthly':
        labels, data = ['Jan', 'Feb', 'Mar', 'Apr'], [85, 87, 88, 90]
        multiplier = 20
    else:
        labels, data = ['Term 1', 'Term 2', 'Term 3'], [80, 85, 88]
        multiplier = 60

    return jsonify({
        "summary": {
            "total_scheduled": total_schedules * multiplier,
            "total_taught": total_sessions * multiplier,
            "total_untaught": total_untaught * multiplier,
            "avg_attendance": sum(data) // len(data) if data else 0
        },
        "chart": {
            "labels": labels,
            "data": data
        }
    })

@app.route('/api/qa/timetable/upload', methods=['POST'])
def qa_upload_timetable():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    try:
        created_count = 0
        errors = []
        records = []

        def normalize_col(c):
            c = str(c).lower().replace(' ', '').replace('_', '')
            if 'unit' in c or 'code' in c: return 'unit_code'
            if 'lec' in c or 'email' in c or 'staff' in c: return 'lecturer'
            if 'venue' in c or 'room' in c or 'lab' in c: return 'venue'
            if 'day' in c: return 'day'
            if 'start' in c or 'time' in c: return 'start_time' # basic fallback
            if 'end' in c: return 'end_time'
            if 'sem' in c or 'term' in c or 'trim' in c: return 'semester'
            return c

        if file.filename.lower().endswith(('.xlsx', '.xls', '.csv')):
            import pandas as pd
            if file.filename.lower().endswith('.csv'):
                df = pd.read_csv(file, header=None)
            else:
                df = pd.read_excel(file, header=None)
            
            # Find the header row dynamically
            header_idx = -1
            for i, row in df.iterrows():
                row_str = ' '.join([str(val).lower() for val in row.values])
                if 'venue' in row_str or 'day' in row_str or 'unit' in row_str or 'code' in row_str:
                    header_idx = i
                    break
            
            if header_idx != -1:
                df.columns = df.iloc[header_idx]
                df = df.iloc[header_idx+1:].reset_index(drop=True)
            else:
                df.columns = df.iloc[0]
                df = df.iloc[1:].reset_index(drop=True)

            raw_columns = [str(c).lower().strip() for c in df.columns]
            
            def is_time_col(c):
                import re
                return bool(re.search(r'\d{1,2}[:.]\d{2}', c))
            
            time_cols = [c for c in raw_columns if is_time_col(c)]
            
            if time_cols and any('day' in c for c in raw_columns) and any('venue' in c for c in raw_columns):
                # Cross-tab format detected
                day_col_idx = next(i for i, c in enumerate(raw_columns) if 'day' in c)
                venue_col_idx = next(i for i, c in enumerate(raw_columns) if 'venue' in c)
                day_col = df.columns[day_col_idx]
                venue_col = df.columns[venue_col_idx]
                
                df[day_col] = df[day_col].replace(r'^\s*$', pd.NA, regex=True).ffill()
                df_melted = df.melt(id_vars=[day_col, venue_col], var_name='time_slot', value_name='class_info')
                df_melted = df_melted.dropna(subset=['class_info'])
                df_melted = df_melted[df_melted['class_info'].astype(str).str.strip() != '']
                df_melted = df_melted[df_melted['class_info'].astype(str).str.lower() != 'nan']
                
                for _, row in df_melted.iterrows():
                    info = str(row['class_info']).strip()
                    if not info or info.lower() == 'nan':
                        continue
                    parts = info.split('-', 1)
                    unit = parts[0].strip()
                    lec = parts[1].strip() if len(parts) > 1 else "Unknown Lecturer"
                    
                    ts = str(row['time_slot'])
                    start, end = ts, ''
                    if '-' in ts:
                        tparts = ts.split('-', 1)
                        start, end = tparts[0].strip(), tparts[1].strip()
                        
                    records.append({
                        'unit_code': unit,
                        'lecturer': lec,
                        'venue': row[venue_col],
                        'day': row[day_col],
                        'start_time': start,
                        'end_time': end,
                        'semester': 'Current Semester'
                    })
            else:
                df.columns = [normalize_col(c) for c in df.columns]
                df = df.fillna('')
                records = df.to_dict('records')
            
        elif file.filename.lower().endswith('.pdf'):
            fd, temp_path = tempfile.mkstemp(suffix=".pdf")
            os.close(fd)
            file.save(temp_path)
            
            with pdfplumber.open(temp_path) as pdf:
                for page in pdf.pages:
                    tables = page.extract_tables()
                    for table in tables:
                        if not table or len(table) < 2: continue
                        headers = [normalize_col(c) for c in table[0]]
                        for r in table[1:]:
                            clean_row = [str(cell).replace('\n', ' ').strip() if cell is not None else '' for cell in r]
                            record = dict(zip(headers, clean_row))
                            records.append(record)
            os.remove(temp_path)
            if not records:
                return jsonify({"error": "No tables detected in the PDF"}), 400
        else:
            return jsonify({"error": "Unsupported file format. Please upload CSV, Excel, or PDF."}), 400
        
        # Determine department/programme fallback
        default_dept = Department.query.first()
        if not default_dept:
            default_dept = Department(name="General Department")
            db.session.add(default_dept)
            db.session.commit()

        for row_idx, row in enumerate(records):
            # Extract dynamically mapped fields
            unit_code = str(row.get('unit_code', '')).strip()
            lec_ident = str(row.get('lecturer', '')).strip()
            venue_name = str(row.get('venue', '')).strip()
            day = str(row.get('day', '')).strip()
            start = str(row.get('start_time', '')).strip()
            end = str(row.get('end_time', '')).strip()
            sem = str(row.get('semester', 'Default Semester')).strip()
            
            # For time if only one time column exists, try to split it
            if start and not end and '-' in start:
                parts = start.split('-')
                start = parts[0].strip()
                end = parts[1].strip()

            if not unit_code or not lec_ident or not venue_name:
                keys = list(row.keys())
                errors.append(f"Row {row_idx+2}: Missing essential data. We got keys: {keys}, row data: {row}")
                continue
            
            # Auto-create entities if they don't exist
            unit = Unit.query.filter_by(code=unit_code).first()
            if not unit:
                unit = Unit(code=unit_code, name=f"Unit {unit_code}", department_id=default_dept.id)
                db.session.add(unit)
                db.session.flush() # get ID
                
            # Lecturer might be email or name depending on the file
            lecturer = Lecturer.query.filter((Lecturer.email == lec_ident) | (Lecturer.name == lec_ident)).first()
            if not lecturer:
                lecturer = Lecturer(name=lec_ident, email=lec_ident if '@' in lec_ident else None, department_id=default_dept.id)
                db.session.add(lecturer)
                db.session.flush()
                
            venue = Venue.query.filter_by(name=venue_name).first()
            if not venue:
                venue = Venue(name=venue_name)
                db.session.add(venue)
                db.session.flush()
                
            schedule = ClassSchedule(
                unit_id=unit.id, lecturer_id=lecturer.id, venue_id=venue.id,
                day_of_week=day, start_time=start, end_time=end, semester=sem
            )
            db.session.add(schedule)
            created_count += 1
            
        db.session.commit()
        return jsonify({"message": f"Successfully imported {created_count} schedules", "errors": errors})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

def _student_summary(student):
    return {"name": student.name, "reg_no": student.reg_no,
            "year_of_study": student.year_of_study,
            "avatar": student.avatar or f"https://ui-avatars.com/api/?name={student.name.replace(' ', '+')}&background=random"}

def _audit(action, details=None):
    log = AuditLog(action=action, details=json.dumps(details or {}))
    db.session.add(log)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5000, debug=True)
