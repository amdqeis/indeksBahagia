# Berkas: api_datatable.py (Atau tambahkan ke api.py Anda)

from flask import request, jsonify, session
from . import api
from ..models import User, RecordSiswaHarian, RecordSiswaMingguan, Note, SchoolClass
from sqlalchemy import or_, desc, asc, func, case, extract
from sqlalchemy.orm import aliased
from datetime import datetime, date, timedelta
import calendar
from app.extentions import db
from ..constants import is_valid_class_name, normalize_class_name

# --- Helper untuk Cek Otorisasi (MODIFIED) ---
def check_teacher_admin_access():
    """
    Memeriksa apakah pengguna adalah 'admin' atau 'guru'.
    Mengembalikan objek 'user' jika diizinkan.
    """
    user_id = session.get('user_id')
    role = session.get('role')
    
    if not user_id:
        return (False, jsonify({"message": "Autentikasi diperlukan"}), 401)
        
    # Hanya 'admin' (Guru BK) dan 'guru' (Wali Kelas) yang bisa akses
    if role not in ['admin', 'guru']: 
        return (False, jsonify({"message": "Akses ditolak untuk role Anda"}), 403)
        
    user = User.query.get(user_id)
    if not user:
        return (False, jsonify({"message": "User tidak ditemukan"}), 401)
        
    # Jika guru, pastikan dia punya kelas
    if role == 'guru' and not user.kelas:
        return (False, jsonify({"message": "Akun guru Anda tidak terhubung ke kelas manapun"}), 403)
        
    return (True, user, 200) # Mengembalikan user object yang sedang login

# === RUTE API SISWA (Data Table) (MODIFIED) ===

@api.route('/siswa', methods=['GET'])
def get_siswa():
    # 'current_user' adalah admin atau guru yang login
    is_allowed, current_user, status = check_teacher_admin_access()
    if not is_allowed:
        return current_user, status # current_user adalah jsonify error
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '')
    ui_kelas_filter = request.args.get('kelas', '') # Filter dari UI dropdown
    sort_by = request.args.get('sort_by', 'email')
    sort_order = request.args.get('sort_order', 'asc')

    # Subquery untuk Skor Harian Terbaru
    latest_score_sq = db.session.query(
        RecordSiswaHarian.user_id,
        RecordSiswaHarian.skor,
        func.rank().over(
            partition_by=RecordSiswaHarian.user_id,
            order_by=RecordSiswaHarian.date.desc()
        ).label('rnk')
    ).subquery()
    
    latest_score_alias = aliased(latest_score_sq)
    
    query = db.session.query(
        User,
        latest_score_alias.c.skor.label('skor_harian_terbaru')
    ).outerjoin(
        latest_score_alias,
        (User.id == latest_score_alias.c.user_id) & (latest_score_alias.c.rnk == 1)
    )

    # Filter dasar: Hanya tampilkan 'user' (Siswa)
    query = query.filter(User.role == 'user')

    # === PERUBAHAN LOGIKA ROLE ===
    if current_user.role == 'guru':
        # Guru HANYA bisa lihat kelasnya.
        query = query.filter(User.kelas == current_user.kelas)
    # Jika 'admin', tidak perlu filter kelas tambahan.
    # ===============================

    # Terapkan filter dari UI (Dropdown Kelas)
    if ui_kelas_filter:
        ui_kelas_filter = normalize_class_name(ui_kelas_filter)
        if not ui_kelas_filter or not is_valid_class_name(ui_kelas_filter):
            return jsonify({"message": "Filter kelas tidak valid"}), 400
        query = query.filter(User.kelas == ui_kelas_filter)

    # Terapkan filter pencarian
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                User.email.ilike(search_term),
                User.kode.ilike(search_term),
                User.kelas.ilike(search_term)
            )
        )

    # Terapkan sorting
    sort_column = getattr(User, sort_by, User.email)
    if sort_order == 'desc':
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))
        
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    results = pagination.items
    
    data = []
    for user, skor in results:
        data.append({
            "id": user.id,
            "email": user.email,
            "role": user.role, # Role di sini akan selalu 'user'
            "kode": user.kode,
            "kelas": user.kelas,
            "skor_harian_terbaru": skor,
            "created_at": user.created_at.isoformat()
        })

    return jsonify({
        "data": data,
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": page
    })

@api.route('/siswa/filters', methods=['GET'])
def get_siswa_filter_options():
    is_allowed, current_user, status = check_teacher_admin_access()
    if not is_allowed:
        return current_user, status
        
    kelas_list_q = []
    
    # === PERUBAHAN LOGIKA ROLE ===
    if current_user.role == 'admin':
        # Admin melihat semua kelas tetap dari master kelas
        kelas_list_q = db.session.query(SchoolClass.name).order_by(SchoolClass.name).all()
        
    elif current_user.role == 'guru':
        # Guru hanya melihat kelasnya di dropdown
        if current_user.kelas and is_valid_class_name(current_user.kelas):
            kelas_list_q = [(current_user.kelas,)] 
        else:
            kelas_list_q = []
    # ===============================
    
    return jsonify({
        "kelas_list": [k[0] for k in kelas_list_q if k[0] is not None]
    })

@api.route('/siswa/dashboard/<int:id>', methods=['GET'])
def get_siswa_dashboard(id):
    is_allowed, current_user, status = check_teacher_admin_access()
    if not is_allowed:
        return current_user, status
        
    target_siswa = User.query.get_or_404(id)
    if target_siswa.role != 'user':
        return jsonify({"message": "User yang diminta bukan siswa"}), 404
        
    # === PERUBAHAN LOGIKA ROLE ===
    if current_user.role == 'guru':
        if target_siswa.kelas != current_user.kelas:
            return jsonify({"message": "Akses ke siswa ini ditolak"}), 403
    # Admin bisa lanjut
    # ===============================
        
    latest_record = RecordSiswaHarian.query.filter_by(user_id=id).order_by(RecordSiswaHarian.date.desc()).first()
    
    Creator = aliased(User)
    catatan_data = db.session.query(Note, Creator.email).join(
        Creator, Note.creator_id == Creator.id
    ).filter(
        Note.target_id == id
    ).order_by(Note.date.desc()).all()
    
    catatan_bk = [
        {
            "id": note.id,
            "date": note.date.isoformat(),
            "message": note.message,
            "creator_name": creator_email
        } for note, creator_email in catatan_data
    ]
    
    alert_data = RecordSiswaHarian.query.filter(
        RecordSiswaHarian.user_id == id,
        RecordSiswaHarian.skor < 59
    ).order_by(RecordSiswaHarian.date.desc()).all()
    
    riwayat_alert = [
        {
            "id": r.id,
            "date": r.date.isoformat(),
            "jenis_alert": "Psikologis (SHI Rendah)", 
            "status": "Perlu Tinjauan" 
        } for r in alert_data
    ]

    dashboard_data = {
        "id": target_siswa.id,
        "email": target_siswa.email,
        "role": target_siswa.role,
        "kode": target_siswa.kode,
        "kelas": target_siswa.kelas,
        "skor_terbaru": latest_record.skor if latest_record else None,
        "catatan_bk": catatan_bk,
        "riwayat_alert": riwayat_alert
    }
    
    return jsonify(dashboard_data)

# === RUTE API BARU UNTUK LINE CHART ===

@api.route('/siswa/tren/harian/<int:id>', methods=['GET'])
def get_siswa_tren_harian(id):
    is_allowed, current_user, status = check_teacher_admin_access()
    if not is_allowed:
        return current_user, status
        
    target_siswa = User.query.get_or_404(id)
    if target_siswa.role != 'user':
        return jsonify({"message": "User bukan siswa"}), 404
        
    # === PERUBAHAN LOGIKA ROLE ===
    if current_user.role == 'guru':
        if target_siswa.kelas != current_user.kelas:
            return jsonify({"message": "Akses ditolak"}), 403
    # ===============================
            
    today = date.today()
    start_date = today - timedelta(days=6)
    day_names_id = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

    tren_data = RecordSiswaHarian.query.filter(
        RecordSiswaHarian.user_id == id,
        func.date(RecordSiswaHarian.date) >= start_date,
        func.date(RecordSiswaHarian.date) <= today
    ).order_by(RecordSiswaHarian.date.asc()).all()
    
    scores_by_date = {r.date.date(): r.skor for r in tren_data}
    
    result_data = []
    for i in range(7):
        current_date = start_date + timedelta(days=i)
        day_index = current_date.weekday()
        result_data.append({
            "name": day_names_id[day_index],
            "value": scores_by_date.get(current_date, 0)
        })

    return jsonify({"data": result_data})

@api.route('/siswa/tren/mingguan/<int:id>', methods=['GET'])
def get_siswa_tren_mingguan(id):
    is_allowed, current_user, status = check_teacher_admin_access()
    if not is_allowed:
        return current_user, status
        
    target_siswa = User.query.get_or_404(id)
    if target_siswa.role != 'user':
        return jsonify({"message": "User bukan siswa"}), 404
        
    # === PERUBAHAN LOGIKA ROLE ===
    if current_user.role == 'guru':
        if target_siswa.kelas != current_user.kelas:
            return jsonify({"message": "Akses ditolak"}), 403
    # ===============================
            
    today = date.today()
    start_of_this_week = today - timedelta(days=today.weekday())
    start_date = start_of_this_week - timedelta(weeks=3)

    tren_data = RecordSiswaMingguan.query.filter(
        RecordSiswaMingguan.user_id == id,
        func.date(RecordSiswaMingguan.date) >= start_date
    ).order_by(RecordSiswaMingguan.date.asc()).all()

    scores_by_week = {}
    for r in tren_data:
        week_diff = (r.date.date() - start_date).days // 7
        week_label = f"Minggu {week_diff + 1}"
        if week_label not in scores_by_week:
            scores_by_week[week_label] = []
        scores_by_week[week_label].append(r.skor)

    result_data = []
    for i in range(4):
        week_label = f"Minggu {i + 1}"
        scores = scores_by_week.get(week_label, [0])
        avg_score = sum(scores) / len(scores)
        result_data.append({
            "name": week_label,
            "value": avg_score
        })

    return jsonify({"data": result_data})


# === RUTE AKSI (DELETE, NOTE) DENGAN VALIDASI ROLE ===

@api.route('/siswa/<int:id>', methods=['DELETE'])
def delete_siswa(id):
    is_allowed, current_user, status = check_teacher_admin_access()
    if not is_allowed:
        return current_user, status

    user_to_delete = User.query.get_or_404(id)
    if user_to_delete.role != 'user':
        return jsonify({"message": "Hanya siswa yang bisa dihapus"}), 400
    
    # === PERUBAHAN LOGIKA ROLE ===
    if current_user.role == 'guru':
        if user_to_delete.kelas != current_user.kelas:
            return jsonify({"message": "Akses ditolak"}), 403
    # ===============================
            
    try:
        db.session.delete(user_to_delete)
        db.session.commit()
        return jsonify({"message": "Data siswa berhasil dihapus"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Gagal menghapus: {str(e)}"}), 500

@api.route('/siswa/bulk-delete', methods=['POST'])
def bulk_delete_siswa():
    is_allowed, current_user, status = check_teacher_admin_access()
    if not is_allowed:
        return current_user, status

    data = request.json
    ids_to_delete = data.get('ids', [])
    
    if not ids_to_delete:
        return jsonify({"message": "Tidak ada ID yang dipilih"}), 400
    
    query_to_delete = User.query.filter(User.id.in_(ids_to_delete), User.role == 'user')
    
    # === PERUBAHAN LOGIKA ROLE ===
    if current_user.role == 'guru':
        query_to_delete = query_to_delete.filter(User.kelas == current_user.kelas)
    # ===============================
        
    try:
        deleted_count = query_to_delete.delete(synchronize_session=False)
        db.session.commit()
        
        if deleted_count == 0 and len(ids_to_delete) > 0:
             return jsonify({"message": "Gagal menghapus: Siswa tidak ditemukan atau bukan di kelas Anda"}), 403
             
        return jsonify({"message": f"{deleted_count} data siswa berhasil dihapus"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Gagal menghapus: {str(e)}"}), 500

@api.route('/notes', methods=['POST'])
def add_note():
    is_allowed, creator, status = check_teacher_admin_access()
    if not is_allowed:
        return creator, status
        
    data = request.json
    target_id = data.get('target_id')
    message = data.get('message')

    if not target_id or not message:
        return jsonify({"message": "Target ID dan pesan diperlukan"}), 400
        
    target_siswa = User.query.get(target_id)
    if not target_siswa or target_siswa.role != 'user':
        return jsonify({"message": "Siswa tidak ditemukan"}), 404
        
    # === PERUBAHAN LOGIKA ROLE ===
    if creator.role == 'guru':
        if target_siswa.kelas != creator.kelas:
             return jsonify({"message": "Anda hanya bisa menambah catatan untuk siswa di kelas Anda"}), 403
    # ===============================

    try:
        new_note = Note(
            message=message,
            creator_id=creator.id,
            target_id=target_id,
            date=datetime.now()
        )
        db.session.add(new_note)
        db.session.commit()
        
        return jsonify({
            "message": "Catatan berhasil disimpan",
            "note": {
                "id": new_note.id,
                "date": new_note.date.isoformat(),
                "message": new_note.message,
                "creator_name": creator.email
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Gagal menyimpan catatan: {str(e)}"}), 500
    
# Berkas: api_datatable.py (Tambahkan di bagian akhir)

@api.route('/tren/overall/harian', methods=['GET'])
def get_overall_tren_harian():
    """
    Endpoint PUBLIK untuk mengambil tren harian RATA-RATA SEMUA SISWA.
    """
    today = date.today()
    start_date = today - timedelta(days=6) # 7 hari terakhir
    day_names_id = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

    # Ambil rata-rata skor per hari, untuk SEMUA siswa (role 'user')
    tren_data = db.session.query(
        func.date(RecordSiswaHarian.date).label('tanggal'),
        func.avg(RecordSiswaHarian.skor).label('rata_skor')
    ).join(User, User.id == RecordSiswaHarian.user_id).filter(
        User.role == 'user',
        func.date(RecordSiswaHarian.date) >= start_date,
        func.date(RecordSiswaHarian.date) <= today
    ).group_by('tanggal').order_by('tanggal').all()
    
    scores_by_date = {r.tanggal: r.rata_skor for r in tren_data}
    
    result_data = []
    for i in range(7):
        current_date = start_date + timedelta(days=i)
        day_index = current_date.weekday()
        
        result_data.append({
            "name": day_names_id[day_index],
            "value": scores_by_date.get(current_date, 0)
        })

    return jsonify({"data": result_data})

@api.route('/tren/overall/mingguan', methods=['GET'])
def get_overall_tren_mingguan():
    """
    Endpoint PUBLIK untuk mengambil tren mingguan RATA-RATA SEMUA SISWA.
    """
    today = date.today()
    start_of_this_week = today - timedelta(days=today.weekday())
    start_date = start_of_this_week - timedelta(weeks=3) # 4 pekan terakhir

    # Ambil rata-rata skor per pekan, untuk SEMUA siswa
    tren_data = db.session.query(
        # Kelompokkan berdasarkan nomor pekan
        extract('week', RecordSiswaMingguan.date).label('pekan'),
        func.avg(RecordSiswaMingguan.skor).label('rata_skor')
    ).join(User, User.id == RecordSiswaMingguan.user_id).filter(
        User.role == 'user',
        func.date(RecordSiswaMingguan.date) >= start_date
    ).group_by('pekan').order_by('pekan').all()
    
    # Perlu menyederhanakan ini karena pengelompokan pekan lebih kompleks
    # Mari kita gunakan logika yang sama dengan tren mingguan individu
    
    all_records = RecordSiswaMingguan.query.join(User).filter(
        User.role == 'user',
        func.date(RecordSiswaMingguan.date) >= start_date
    ).all()
    
    scores_by_week = {}
    for r in all_records:
        week_diff = (r.date.date() - start_date).days // 7
        week_label = f"Minggu {week_diff + 1}"
        if week_label not in scores_by_week:
            scores_by_week[week_label] = []
        scores_by_week[week_label].append(r.skor)

    result_data = []
    for i in range(4):
        week_label = f"Minggu {i + 1}"
        scores = scores_by_week.get(week_label, [0])
        avg_score = sum(scores) / len(scores)
        
        result_data.append({
            "name": week_label,
            "value": avg_score
        })

    return jsonify({"data": result_data})    
    
    
