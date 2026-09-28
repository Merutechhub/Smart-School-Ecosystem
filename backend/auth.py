from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import generate_password_hash, check_password_hash
from database import db, User, Student, Lecturer
from datetime import datetime, timezone
import json

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    if not user.password_hash or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid email or password"}), 401

    if user.status != 'Active':
        return jsonify({"error": "Account is inactive. Contact admin."}), 403

    # Build identity payload
    identity = str(user.id)
    additional_claims = {
        "role": user.role.lower(),
        "name": user.name,
        "email": user.email,
    }

    # Attach student/lecturer extra data
    if user.role.lower() == 'student':
        student = Student.query.filter_by(user_id=user.id).first()
        if student:
            additional_claims["uid"] = student.uid
            additional_claims["reg_no"] = student.reg_no
    elif user.role.lower() == 'lecturer':
        lecturer = Lecturer.query.filter_by(user_id=user.id).first()
        if lecturer:
            additional_claims["lecturer_id"] = lecturer.id

    user.last_login = datetime.now(timezone.utc)
    db.session.commit()

    token = create_access_token(identity=identity, additional_claims=additional_claims)

    return jsonify({
        "token": token,
        "user": {
            "id": user.id,
            "role": user.role.lower(),
            "name": user.name,
            "email": user.email,
            **({k: v for k, v in additional_claims.items() if k not in ["role", "name", "email"]})
        }
    })

@auth_bp.route('/api/auth/me', methods=['GET'])
@jwt_required()
def me():
    claims = get_jwt()
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({
        "id": user.id,
        "role": claims.get("role"),
        "name": claims.get("name"),
        "email": claims.get("email"),
        "uid": claims.get("uid"),
        "reg_no": claims.get("reg_no"),
        "lecturer_id": claims.get("lecturer_id"),
    })

@auth_bp.route('/api/auth/change-password', methods=['POST'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    data = request.json
    old_pw = data.get('old_password', '')
    new_pw = data.get('new_password', '')

    if not old_pw or not new_pw:
        return jsonify({"error": "Both old and new passwords are required"}), 400
    if len(new_pw) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400

    user = User.query.get(int(user_id))
    if not check_password_hash(user.password_hash, old_pw):
        return jsonify({"error": "Old password is incorrect"}), 403

    user.password_hash = generate_password_hash(new_pw)
    db.session.commit()
    return jsonify({"message": "Password changed successfully"})
