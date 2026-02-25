from flask import request, jsonify, session
from . import api
from ..models import User, RecordSiswaHarian, RecordSiswaMingguan
from datetime import date, datetime, timedelta
from sqlalchemy import func, or_, cast, Date, distinct
import math
from app.extentions import db
from ..constants import is_valid_class_name, normalize_class_name


@api.route('/word-cloud', methods=["POST"])
def word_cloud():
    kelas = session.get('kelas')
    today = date.today()
    
    data = request.get_json()
    user_ids = [u.id for u in User.query.filter_by(kelas=kelas).all()]
    tipe = data.get('type')
    if tipe == 'harian':
        data = (
        db.session.query(RecordSiswaHarian.rasakan)
        .filter(
            RecordSiswaHarian.user_id.in_(user_ids),
            func.date(RecordSiswaHarian.date) == today
        )
        .all()
    )

    elif tipe == 'mingguan':
        data = (
        db.session.query(RecordSiswaMingguan.open_question)
        .filter(
            RecordSiswaMingguan.user_id.in_(user_ids),
            func.date(RecordSiswaMingguan.date) == today
        )
        .all()
    )

    # convert list of tuples to list of strings
    list_text = [row[0] for row in data]

    print(list_text, "OPEN QUESTION")

    return jsonify({
        'message': 'success',
        'text': list_text
    }), 200



@api.route('/shi-overall', methods=["POST"])
def shi_overall():
    kelas = session.get('kelas')
    today = date.today()
    
    data = request.get_json()
    user_ids = [u.id for u in User.query.filter_by(kelas=kelas).all()]
    tipe = data.get('type')
    if tipe == 'harian':
        avg = db.session.query(func.avg(RecordSiswaHarian.skor)).filter(
            RecordSiswaHarian.user_id.in_(user_ids),
            func.date(RecordSiswaHarian.date) == today
        ).scalar()
    if tipe == 'mingguan':
        avg = db.session.query(func.avg(RecordSiswaMingguan.skor)).filter(
            RecordSiswaMingguan.user_id.in_(user_ids),
            func.date(RecordSiswaMingguan.date) == today
        ).scalar()
        

    print(avg, "SHI GAES")
    
    return jsonify({
        'message'    : 'success',
        'shi': avg
    }), 200

@api.route('/heatmap', methods=["POST"])
def heatmap():
    data = request.get_json()
    kelas = data.get('kelas')
    start_date_raw = data.get('start_date')
    end_date_raw = data.get('end_date')
    page = int(data.get('page', 1))
    limit = int(data.get('limit', 20))

    if not kelas or not start_date_raw or not end_date_raw:
        return jsonify({"message": "kelas, start_date, and end_date are required"}), 400

    if kelas != "Semua Kelas":
        kelas = normalize_class_name(kelas)
        if not kelas or not is_valid_class_name(kelas):
            return jsonify({"message": "kelas tidak valid"}), 400

    try:
        start_date = datetime.strptime(start_date_raw, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_raw, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"message": "invalid date format, use YYYY-MM-DD"}), 400

    if start_date > end_date:
        return jsonify({"message": "start_date must be before or equal to end_date"}), 400

    # Filter kelas
    if kelas == "Semua Kelas":
        kelas_filter = True
    else:
        kelas_filter = (User.kelas == kelas)

    # Ambil siswa yang cocok
    students_query = db.session.query(User.id, User.fullname).filter(kelas_filter, User.role == "user")

    total_students = students_query.count()
    total_pages = math.ceil(total_students / limit)

    # Pagination database (supaya ringan)
    students = (
        students_query
        .order_by(User.fullname)
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    if not students:
        return jsonify({
            "students": [],
            "dates": [],
            "values": [],
            "total_students": 0,
            "total_pages": 0
        }), 200

    student_ids = [s.id for s in students]

    # Ambil semua record di rentang tanggal untuk siswa yang tampil
    records = (
        RecordSiswaHarian.query
        .filter(
            RecordSiswaHarian.user_id.in_(student_ids),
            func.date(RecordSiswaHarian.date).between(start_date, end_date)
        )
        .with_entities(
            RecordSiswaHarian.user_id,
            func.date(RecordSiswaHarian.date),
            RecordSiswaHarian.skor
        )
        .all()
    )

    # Format daftar tanggal
    date_list = []
    current = start_date
    while current <= end_date:
        date_list.append(current.strftime("%d %b"))
        current += timedelta(days=1)

    # Siapkan struktur array 2 dimensi
    values = []
    # values[row][col]  <-- row = siswa, col = tanggal

    # Buat dictionary untuk akses cepat
    record_map = {f"{uid}-{d.strftime('%d %b')}": skor for uid, d, skor in records}

    values = []  # hasil akhir: list of rows (array 2D)

    # students adalah list of tuples (id, fullname)
    for s_id, _ in students:
        row_values = []
        for d in date_list:
            score = record_map.get(f"{s_id}-{d}", None)
            row_values.append(score)
        values.append(row_values)

    valid_columns = []

    for col_idx in range(len(date_list)):
        # Cek apakah ada minimal satu siswa yang memiliki nilai bukan None di kolom ini
        any_score = any(row[col_idx] is not None for row in values)
        if any_score:
            valid_columns.append(col_idx)

    # Buang tanggal yang semua None
    date_list = [date_list[i] for i in valid_columns]

    # Buang nilai yang semua None kolomnya
    values = [
        [row[i] for i in valid_columns]
        for row in values
    ]
    
    return jsonify({
        "students": [s.fullname for s in students],
        "dates": date_list,
        "values": values,
        "total_students": total_students,
        "total_pages": total_pages
    }), 200


@api.route('/get-alerts', methods=["POST"])
def alert_counter():
    data = request.get_json()
    kelas = data.get('kelas')
    start_date_raw = data.get('start_date')
    end_date_raw = data.get('end_date')

    if not (kelas and start_date_raw and end_date_raw):
        return jsonify({'message': 'Error kelas/start_date/end_date not found'}), 400

    if kelas != "Semua Kelas":
        kelas = normalize_class_name(kelas)
        if not kelas or not is_valid_class_name(kelas):
            return jsonify({"message": "kelas tidak valid"}), 400

    try:
        start_date = datetime.strptime(start_date_raw, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_raw, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"message": "invalid date format, use YYYY-MM-DD"}), 400

    if start_date > end_date:
        return jsonify({"message": "start_date must be before or equal to end_date"}), 400

    if kelas == "Semua Kelas":
        kelas_filter = True
    else:
        kelas_filter = User.kelas == kelas

    # Alert 1: siswa dengan minimal 3 entri skor < 40 dalam rentang tanggal
    alert1 = (
        db.session.query(RecordSiswaHarian.user_id)
        .join(User, User.id == RecordSiswaHarian.user_id)
        .filter(
            kelas_filter,
            func.date(RecordSiswaHarian.date).between(start_date, end_date),
            RecordSiswaHarian.skor < 40,
        )
        .group_by(RecordSiswaHarian.user_id)
        .having(func.count(RecordSiswaHarian.id) >= 3)
        .all()
    )

    # Alert 2: indikator tidak aman/bullying pada survei mingguan di rentang tanggal
    alert2 = (
        db.session.query(RecordSiswaMingguan.user_id)
        .join(User, User.id == RecordSiswaMingguan.user_id)
        .filter(
            kelas_filter,
            func.date(RecordSiswaMingguan.date).between(start_date, end_date),
            or_(
                RecordSiswaMingguan.aman <= 2,
                RecordSiswaMingguan.bullying == 1
            )
        )
        .group_by(RecordSiswaMingguan.user_id)
        .all()
    )

    # Alert 3: siswa dengan penurunan >= 15 dari skor awal ke skor akhir dalam rentang
    earliest_score_date_sq = (
        db.session.query(
            RecordSiswaHarian.user_id.label("user_id"),
            func.min(RecordSiswaHarian.date).label("earliest_date")
        )
        .join(User, User.id == RecordSiswaHarian.user_id)
        .filter(
            kelas_filter,
            func.date(RecordSiswaHarian.date).between(start_date, end_date),
        )
        .group_by(RecordSiswaHarian.user_id)
        .subquery()
    )

    latest_score_date_sq = (
        db.session.query(
            RecordSiswaHarian.user_id.label("user_id"),
            func.max(RecordSiswaHarian.date).label("latest_date")
        )
        .join(User, User.id == RecordSiswaHarian.user_id)
        .filter(
            kelas_filter,
            func.date(RecordSiswaHarian.date).between(start_date, end_date),
        )
        .group_by(RecordSiswaHarian.user_id)
        .subquery()
    )

    earliest_scores = (
        db.session.query(
            RecordSiswaHarian.user_id.label("user_id"),
            RecordSiswaHarian.skor.label("earliest_score")
        )
        .join(
            earliest_score_date_sq,
            (RecordSiswaHarian.user_id == earliest_score_date_sq.c.user_id)
            & (RecordSiswaHarian.date == earliest_score_date_sq.c.earliest_date)
        )
        .subquery()
    )

    latest_scores = (
        db.session.query(
            RecordSiswaHarian.user_id.label("user_id"),
            RecordSiswaHarian.skor.label("latest_score")
        )
        .join(
            latest_score_date_sq,
            (RecordSiswaHarian.user_id == latest_score_date_sq.c.user_id)
            & (RecordSiswaHarian.date == latest_score_date_sq.c.latest_date)
        )
        .subquery()
    )

    alert3 = (
        db.session.query(latest_scores.c.user_id)
        .join(earliest_scores, latest_scores.c.user_id == earliest_scores.c.user_id)
        .filter((earliest_scores.c.earliest_score - latest_scores.c.latest_score) >= 15)
        .all()
    )

    return jsonify({
        'alert1': len(alert1),
        'alert2': len(alert2),
        'alert3': len(alert3)
    }), 200


@api.route('/get-top-low-tren', methods=["POST"])
def get_top_low_tren():
    data = request.get_json()
    kelas = data.get('kelas')
    start_date_raw = data.get('start_date')
    end_date_raw = data.get('end_date')

    if not kelas or not start_date_raw or not end_date_raw:
        return jsonify({"message": "kelas, start_date, and end_date are required"}), 400
    if kelas != "Semua Kelas":
        kelas = normalize_class_name(kelas)
        if not kelas or not is_valid_class_name(kelas):
            return jsonify({"message": "kelas tidak valid"}), 400

    try:
        start_date = datetime.strptime(start_date_raw, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_raw, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"message": "invalid date format, use YYYY-MM-DD"}), 400

    if start_date > end_date:
        return jsonify({"message": "start_date must be before or equal to end_date"}), 400

    if kelas == "Semua Kelas":
        kelas_filter = True
    else:
        kelas_filter = (User.kelas == kelas)

    # Nilai terawal dalam rentang tanggal
    earliest_score_date_sq = (
        db.session.query(
            RecordSiswaHarian.user_id.label("user_id"),
            func.min(RecordSiswaHarian.date).label("earliest_date")
        )
        .join(User, User.id == RecordSiswaHarian.user_id)
        .filter(
            kelas_filter,
            func.date(RecordSiswaHarian.date).between(start_date, end_date)
        )
        .group_by(RecordSiswaHarian.user_id)
        .subquery()
    )

    earliest_data_sq = (
        db.session.query(
            RecordSiswaHarian.user_id.label("user_id"),
            RecordSiswaHarian.skor.label("earliest_score")
        )
        .join(
            earliest_score_date_sq,
            (RecordSiswaHarian.user_id == earliest_score_date_sq.c.user_id) &
            (RecordSiswaHarian.date == earliest_score_date_sq.c.earliest_date)
        )
        .subquery()
    )

    # Nilai terbaru dalam rentang tanggal
    latest_score_date_sq = (
        db.session.query(
            RecordSiswaHarian.user_id.label("user_id"),
            func.max(RecordSiswaHarian.date).label("latest_date")
        )
        .join(User, User.id == RecordSiswaHarian.user_id)
        .filter(
            kelas_filter,
            func.date(RecordSiswaHarian.date).between(start_date, end_date)
        )
        .group_by(RecordSiswaHarian.user_id)
        .subquery()
    )

    latest_data_sq = (
        db.session.query(
            RecordSiswaHarian.user_id.label("user_id"),
            RecordSiswaHarian.skor.label("latest_score")
        )
        .join(
            latest_score_date_sq,
            (RecordSiswaHarian.user_id == latest_score_date_sq.c.user_id) &
            (RecordSiswaHarian.date == latest_score_date_sq.c.latest_date)
        )
        .subquery()
    )

    records = (
        db.session.query(
            User.fullname.label("fullname"),
            User.kelas.label("kelas"),
            latest_data_sq.c.latest_score.label("latest_score"),
            (latest_data_sq.c.latest_score - earliest_data_sq.c.earliest_score).label("trend")
        )
        .join(latest_data_sq, latest_data_sq.c.user_id == User.id)
        .join(earliest_data_sq, earliest_data_sq.c.user_id == User.id)
        .filter(kelas_filter)
        .filter((latest_data_sq.c.latest_score - earliest_data_sq.c.earliest_score) < 0)
        .order_by((latest_data_sq.c.latest_score - earliest_data_sq.c.earliest_score))
        .limit(5)
        .all()
    )

    result_json = [
        {
            "fullname": r.fullname,
            "kelas": r.kelas,
            "latest_score": float(r.latest_score),
            "trend": float(r.trend)
        }
        for r in records
    ]

    return jsonify(result_json)

@api.route('/get-barchart', methods=["POST"])
def get_barchart():
    data = request.get_json()
    start_date_raw = data.get('start_date')
    end_date_raw = data.get('end_date')

    if not start_date_raw or not end_date_raw:
        return jsonify({"error": "Parameter 'start_date' dan 'end_date' wajib diisi. Format: YYYY-MM-DD"}), 400

    try:
        start_date = datetime.strptime(start_date_raw, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_raw, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "invalid date format, use YYYY-MM-DD"}), 400

    if start_date > end_date:
        return jsonify({"error": "start_date must be before or equal to end_date"}), 400

    # Query: join Record + User lalu group by kelas pada rentang tanggal terpilih
    result = (
        db.session.query(
            User.kelas.label("kelas"),
            func.avg(RecordSiswaHarian.skor).label("nilai")
        )
        .join(User, User.id == RecordSiswaHarian.user_id)
        .filter(func.date(RecordSiswaHarian.date).between(start_date, end_date))
        .group_by(User.kelas)
        .order_by(User.kelas)
        .all()
    )

    response = [
        {
            "kelas": row.kelas,
            "nilai": round(row.nilai, 2)
        }
        for row in result
    ]

    return jsonify(response), 200

@api.route('/submission-percentage')
def submission_percentage():
    tipe = request.args.get('tipe', 'harian')

    if tipe == 'harian':
        RecordModel = RecordSiswaHarian
    elif tipe == 'mingguan':
        RecordModel = RecordSiswaMingguan
    else:
        return jsonify({
            "message": "Tipe survey tidak valid. Gunakan 'harian' atau 'mingguan'."
        }), 400

    # -----------------------------------------
    # 1. Hitung maksimal pengisian (distinct tanggal)
    # -----------------------------------------
    max_days = db.session.query(
        func.count(
            distinct(cast(RecordModel.date, Date))
        )
    ).scalar() or 0

    # -----------------------------------------
    # 2. Hitung jumlah pengisian per user
    # -----------------------------------------
    submissions = db.session.query(
        User.id.label('user_id'),
        User.fullname,
        User.kelas,
        func.count(
            distinct(cast(RecordModel.date, Date))
        ).label('filled_days')
    ).outerjoin(
        RecordModel, RecordModel.user_id == User.id
    ).group_by(
        User.id
    ).all()

    # -----------------------------------------
    # 3. Bangun response
    # -----------------------------------------
    results = []
    for row in submissions:
        percentage = 0
        if max_days > 0:
            percentage = round((row.filled_days / max_days) * 100, 2)

        results.append({
            "user_id": row.user_id,
            "fullname": row.fullname,
            "kelas": row.kelas,
            "filled_days": row.filled_days,
            "max_days": max_days,
            "percentage": percentage
        })

    return jsonify({
        "tipe": tipe,
        "max_distinct_days": max_days,
        "data": results
    }), 200
