import json
from datetime import datetime, date, timedelta
from werkzeug.security import generate_password_hash
from database import (db, School, Department, Programme, Unit, Lecturer, Venue,
                      ClassSchedule, ClassSession, Student, Enrollment, NFCCard, User,
                      AttendanceRecord, TapPoint, Exam, ExamClearance, LibraryMember, Equipment, Event)

def seed_db(app):
    with app.app_context():
        db.drop_all()
        db.create_all()

        # ─── Users with hashed passwords ───
        users = [
            User(role='Admin',    name='Super Admin',       email='admin@kemu.ac.ke',   password_hash=generate_password_hash('admin123'),   status='Active'),
            User(role='Lecturer', name='Dr. John Doe',      email='jdoe@kemu.ac.ke',    password_hash=generate_password_hash('lecturer123'), status='Active'),
            User(role='Lecturer', name='Prof. Jane Smith',  email='jsmith@kemu.ac.ke',  password_hash=generate_password_hash('lecturer123'), status='Active'),
            User(role='Lecturer', name='Dr. Emily White',   email='ewhite@kemu.ac.ke',  password_hash=generate_password_hash('lecturer123'), status='Active'),
            User(role='Lecturer', name='Prof. Robert Brown',email='rbrown@kemu.ac.ke',  password_hash=generate_password_hash('lecturer123'), status='Active'),
            User(role='Lecturer', name='Dr. Sarah Green',   email='sgreen@kemu.ac.ke',  password_hash=generate_password_hash('lecturer123'), status='Active'),
            User(role='QA',       name='QA Officer',        email='qa@kemu.ac.ke',       password_hash=generate_password_hash('qa123'),       status='Active'),
            User(role='Student',  name='Alice Wanjiku',     email='alice@student.kemu.ac.ke', password_hash=generate_password_hash('student123'), status='Active'),
        ]
        db.session.add_all(users)
        db.session.commit()
        admin_user, lec1_user, lec2_user, lec3_user, lec4_user, lec5_user, qa_user, student_user = users

        # ─── Schools / Departments / Programmes ───
        schools_data = [
            {"name": "KeMU Business School", "departments": [
                {"name": "Department of Business Administration", "programmes": [
                    "Bachelor of Business Administration (Finance)",
                    "Bachelor of Business Administration (Accounting)",
                    "Bachelor of Business Administration (Marketing)",
                    "Bachelor of Business Administration (Management)"]}
            ]},
            {"name": "School of Medicine and Health Sciences", "departments": [
                {"name": "Department of Pharmacy", "programmes": ["Bachelor of Pharmacy"]},
                {"name": "Department of Health Systems Management", "programmes": [
                    "Bachelor of Science in Health Systems Management",
                    "Diploma in Clinical Medicine", "Bachelor of Science in Nursing"]}
            ]},
            {"name": "School of Education and Social Sciences", "departments": [
                {"name": "Department of Education", "programmes": [
                    "Bachelor of Education (Arts)", "Bachelor of Education (Special Needs)"]},
                {"name": "Department of Theology and Religious Studies", "programmes": ["Bachelor of Theology"]},
                {"name": "Department of Counselling and Psychology", "programmes": ["Bachelor of Arts in Counselling Psychology"]},
                {"name": "Department of Hospitality and Tourism Management", "programmes": ["Bachelor of Science in Hospitality Management"]}
            ]},
            {"name": "School of Science and Technology", "departments": [
                {"name": "Department of Pure and Applied Sciences", "programmes": [
                    "Bachelor of Science in Agriculture",
                    "Bachelor of Science in Biology",
                    "Bachelor of Science in Environmental Science"]}
            ]},
            {"name": "School of Computing and Informatics", "departments": [
                {"name": "Department of Computer Science", "programmes": [
                    "Bachelor of Science in Computer Information Systems",
                    "Bachelor of Science in Software Engineering",
                    "Bachelor of Business Information Technology"]}
            ]}
        ]

        dept_map = {}
        prog_map = {}
        for s_data in schools_data:
            school = School(name=s_data['name'])
            db.session.add(school)
            db.session.commit()
            for d_data in s_data['departments']:
                dept = Department(name=d_data['name'], school_id=school.id)
                db.session.add(dept)
                db.session.commit()
                dept_map[d_data['name']] = dept
                for p_name in d_data['programmes']:
                    prog = Programme(name=p_name, department_id=dept.id)
                    db.session.add(prog)
                    db.session.commit()
                    prog_map[p_name] = prog

        dept_comp = dept_map["Department of Computer Science"]
        dept_bus  = dept_map["Department of Business Administration"]
        dept_nur  = dept_map["Department of Health Systems Management"]
        dept_edu  = dept_map["Department of Education"]
        dept_sci  = dept_map["Department of Pure and Applied Sciences"]
        prog_cis  = prog_map["Bachelor of Science in Computer Information Systems"]
        prog_bba  = prog_map["Bachelor of Business Administration (Finance)"]

        # ─── Lecturers ───
        lec1 = Lecturer(name='Dr. John Doe',       user_id=lec1_user.id, department_id=dept_comp.id, email='jdoe@kemu.ac.ke')
        lec2 = Lecturer(name='Prof. Jane Smith',   user_id=lec2_user.id, department_id=dept_bus.id,  email='jsmith@kemu.ac.ke')
        lec3 = Lecturer(name='Dr. Emily White',    user_id=lec3_user.id, department_id=dept_nur.id,  email='ewhite@kemu.ac.ke')
        lec4 = Lecturer(name='Prof. Robert Brown', user_id=lec4_user.id, department_id=dept_edu.id,  email='rbrown@kemu.ac.ke')
        lec5 = Lecturer(name='Dr. Sarah Green',    user_id=lec5_user.id, department_id=dept_sci.id,  email='sgreen@kemu.ac.ke')
        db.session.add_all([lec1, lec2, lec3, lec4, lec5])
        db.session.commit()

        # ─── Units ───
        units = [
            Unit(code='CIS101', name='Introduction to Computer Systems', department_id=dept_comp.id, lecturer_id=lec1.id),
            Unit(code='SWE201', name='Software Engineering Principles',  department_id=dept_comp.id, lecturer_id=lec1.id),
            Unit(code='DBA301', name='Database Management Systems',      department_id=dept_comp.id, lecturer_id=lec1.id),
            Unit(code='BBA201', name='Principles of Finance',            department_id=dept_bus.id,  lecturer_id=lec2.id),
            Unit(code='BBA102', name='Principles of Marketing',          department_id=dept_bus.id,  lecturer_id=lec2.id),
            Unit(code='NUR101', name='Human Anatomy and Physiology',     department_id=dept_nur.id,  lecturer_id=lec3.id),
            Unit(code='HSM201', name='Health Care Management',           department_id=dept_nur.id,  lecturer_id=lec3.id),
            Unit(code='EDU101', name='Philosophy of Education',          department_id=dept_edu.id,  lecturer_id=lec4.id),
            Unit(code='EDU301', name='Educational Psychology',           department_id=dept_edu.id,  lecturer_id=lec4.id),
            Unit(code='BIO101', name='General Biology',                  department_id=dept_sci.id,  lecturer_id=lec5.id),
            Unit(code='CHE201', name='Organic Chemistry',                department_id=dept_sci.id,  lecturer_id=lec5.id),
        ]
        db.session.add_all(units)
        db.session.commit()

        # ─── Venues ───
        venues = [
            Venue(name='Computer Lab 1',      building='Computing Block',        capacity=40,  type='Lab'),
            Venue(name='Computer Lab 2',      building='Computing Block',        capacity=45,  type='Lab'),
            Venue(name='Lecture Theater 1',   building='Main Block',             capacity=120, type='Classroom'),
            Venue(name='Main Auditorium',     building='Main Block',             capacity=300, type='Auditorium'),
            Venue(name='Science Lab 3',       building='Science Block',          capacity=30,  type='Lab'),
            Venue(name='Nursing Skills Lab',  building='Health Sciences Block',  capacity=25,  type='Lab'),
            Venue(name='Room B2',             building='Business Block',         capacity=60,  type='Classroom'),
            Venue(name='Main Exam Hall',      building='Admin Block',            capacity=200, type='Exam Hall'),
        ]
        db.session.add_all(venues)
        db.session.commit()

        # ─── Class Schedules ───
        schedules = [
            ClassSchedule(unit_id=units[0].id, lecturer_id=lec1.id, venue_id=venues[0].id, day_of_week='Monday',    start_time='08:00', end_time='10:00', semester='Jan-Apr 2026'),
            ClassSchedule(unit_id=units[1].id, lecturer_id=lec1.id, venue_id=venues[1].id, day_of_week='Wednesday', start_time='10:00', end_time='13:00', semester='Jan-Apr 2026'),
            ClassSchedule(unit_id=units[3].id, lecturer_id=lec2.id, venue_id=venues[2].id, day_of_week='Tuesday',   start_time='14:00', end_time='16:00', semester='Jan-Apr 2026'),
            ClassSchedule(unit_id=units[5].id, lecturer_id=lec3.id, venue_id=venues[5].id, day_of_week='Thursday',  start_time='09:00', end_time='12:00', semester='Jan-Apr 2026'),
        ]
        db.session.add_all(schedules)
        db.session.commit()

        # ─── TapPoints ───
        tappoints = [
            TapPoint(id='GATE-MAIN',    name='Main Gate',        location='Main Entrance',  building='Gate House',         mode='access',     status='Offline'),
            TapPoint(id='LAB1-READER',  name='Computer Lab 1',   location='Lab 1 Entrance', building='Computing Block',    mode='attendance', venue_id=venues[0].id, status='Offline'),
            TapPoint(id='LAB2-READER',  name='Computer Lab 2',   location='Lab 2 Entrance', building='Computing Block',    mode='attendance', venue_id=venues[1].id, status='Offline'),
            TapPoint(id='EXAM-HALL',    name='Main Exam Hall',   location='Exam Hall Door',  building='Admin Block',        mode='exam',       venue_id=venues[7].id, status='Offline'),
            TapPoint(id='LIB-ENTRY',   name='Library Entry',     location='Library Door',    building='Library Block',      mode='library',    status='Offline'),
            TapPoint(id='EVENT-MAIN',  name='Events Gate',       location='Auditorium Entry', building='Main Block',        mode='event',      venue_id=venues[3].id, status='Offline'),
        ]
        db.session.add_all(tappoints)
        db.session.commit()

        # ─── Students ───
        student_data = [
            ('Alice Wanjiku',   'KeMU/2024/001', 'alice@student.kemu.ac.ke',   prog_cis.id, 2, 'CARD-A1B2C3D4'),
            ('Brian Mutua',     'KeMU/2024/002', 'brian@student.kemu.ac.ke',   prog_cis.id, 2, 'CARD-B2C3D4E5'),
            ('Cynthia Achieng', 'KeMU/2024/003', 'cynthia@student.kemu.ac.ke', prog_cis.id, 1, 'CARD-C3D4E5F6'),
            ('David Otieno',    'KeMU/2024/004', 'david@student.kemu.ac.ke',   prog_bba.id, 3, 'CARD-D4E5F6A7'),
            ('Eve Muthoni',     'KeMU/2024/005', 'eve@student.kemu.ac.ke',     prog_bba.id, 2, 'CARD-E5F6A7B8'),
            ('Frank Kiprotich', 'KeMU/2024/006', 'frank@student.kemu.ac.ke',   prog_cis.id, 1, None),
            ('Grace Njeri',     'KeMU/2024/007', 'grace@student.kemu.ac.ke',   prog_cis.id, 3, 'CARD-G7H8I9J0'),
            ('Hassan Omar',     'KeMU/2024/008', 'hassan@student.kemu.ac.ke',  prog_bba.id, 2, None),
        ]

        students = []
        for i, (name, reg_no, email, prog_id, year, card_uid) in enumerate(student_data):
            uid = f"STU-{i+1:04d}"
            # Link the first student to the created user account
            user_id = student_user.id if email == 'alice@student.kemu.ac.ke' else None
            stu = Student(uid=uid, name=name, reg_no=reg_no, email=email,
                          programme_id=prog_id, year_of_study=year, status='Active', user_id=user_id)
            db.session.add(stu)
            db.session.commit()
            students.append(stu)

            if card_uid:
                card = NFCCard(uid=card_uid, assigned_student_uid=uid, status='Active')
                db.session.add(card)

        db.session.commit()

        # ─── Enrollments ───
        # CIS students in computing units
        cis_students = [s for s in students if s.programme_id == prog_cis.id]
        bba_students = [s for s in students if s.programme_id == prog_bba.id]
        for stu in cis_students:
            for u in units[:3]:  # CIS101, SWE201, DBA301
                db.session.add(Enrollment(student_uid=stu.uid, unit_id=u.id))
        for stu in bba_students:
            for u in units[3:5]:  # BBA201, BBA102
                db.session.add(Enrollment(student_uid=stu.uid, unit_id=u.id))
        db.session.commit()

        # ─── Sample Completed Class Session with Attendance ───
        completed = ClassSession(schedule_id=schedules[0].id, date=date.today() - timedelta(days=7), status='Completed')
        db.session.add(completed)
        db.session.commit()
        for stu in cis_students[:4]:
            db.session.add(AttendanceRecord(session_id=completed.id, student_uid=stu.uid,
                                            nfc_card_uid='', status='Present'))
        db.session.commit()

        # ─── Sample Exam ───
        exam = Exam(unit_id=units[0].id, name='CIS101 End of Semester Exam',
                    exam_date=date.today() + timedelta(days=14),
                    start_time='09:00', end_time='12:00',
                    venue_id=venues[7].id, semester='Jan-Apr 2026', status='Scheduled')
        db.session.add(exam)
        db.session.commit()
        for stu in cis_students:
            db.session.add(ExamClearance(exam_id=exam.id, student_uid=stu.uid,
                                         status='Cleared', cleared_by='Registrar'))
        db.session.commit()

        # ─── Library Members ───
        for stu in students[:5]:
            db.session.add(LibraryMember(student_uid=stu.uid, status='Active',
                                         expiry_date=date.today() + timedelta(days=365)))
        db.session.commit()

        # ─── Equipment ───
        equipment = [
            Equipment(name='Canon EOS Camera',   category='Camera',        serial_no='CAM-001', status='Available'),
            Equipment(name='Dell Laptop #1',      category='Laptop',        serial_no='LAP-001', status='Available'),
            Equipment(name='Dell Laptop #2',      category='Laptop',        serial_no='LAP-002', status='Available'),
            Equipment(name='Arduino Mega Kit',    category='Electronics',   serial_no='ARD-001', status='Available'),
            Equipment(name='Raspberry Pi 4',      category='Electronics',   serial_no='RPI-001', status='Available'),
            Equipment(name='Oscilloscope',        category='Lab Equipment', serial_no='OSC-001', status='Available'),
        ]
        db.session.add_all(equipment)
        db.session.commit()

        # ─── Events ───
        events = [
            Event(name='KeMU Tech Expo 2026',          description='Annual technology exhibition',
                  event_date=date.today() + timedelta(days=30), start_time='09:00', end_time='17:00',
                  venue_id=venues[3].id, organizer='School of Computing', capacity=300, status='Upcoming'),
            Event(name='Entrepreneurship Workshop',    description='Business skills workshop for students',
                  event_date=date.today() + timedelta(days=10), start_time='10:00', end_time='15:00',
                  venue_id=venues[2].id, organizer='KeMU Business School', capacity=120, status='Upcoming'),
        ]
        db.session.add_all(events)
        db.session.commit()

        print("\nDatabase seeded successfully!")
        print("\nLogin Credentials:")
        print("   Admin:    admin@kemu.ac.ke           / admin123")
        print("   Lecturer: jdoe@kemu.ac.ke            / lecturer123")
        print("   QA:       qa@kemu.ac.ke              / qa123")
        print("   Student:  alice@student.kemu.ac.ke   / student123")

if __name__ == '__main__':
    from app import app
    seed_db(app)
