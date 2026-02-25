from . import api
from flask import jsonify
from flask_bcrypt import Bcrypt
from faker import Faker
import random
from datetime import datetime, timedelta, date
from app.extentions import db
from ..models import (
    User,
    SchoolClass,
    RecordSiswaHarian,
    RecordSiswaMingguan,
    Note
)
from ..constants import FIXED_CLASS_LIST

bcrypt = Bcrypt()
faker = Faker("id_ID")  # Menggunakan region Indonesia

# ==========================================
# KONFIGURASI GENERATOR DATA
# ==========================================
TOTAL_SISWA = 50          # Jumlah siswa yang akan dibuat
TOTAL_GURU = 5            # Jumlah guru
TOTAL_ADMIN = 2           # Jumlah admin
RENTANG_HARI = 40         # Data record untuk 40 hari ke belakang
KELAS_LIST = FIXED_CLASS_LIST
PASSWORD_DEFAULT = "123456" # Password default untuk semua user

# Pilihan untuk Survey Mingguan (sesuai frontend)
OPSI_TIDUR = ["< 6 jam", "6-7 jam", "7-8 jam", "> 8 jam"]
OPSI_KEHADIRAN = ["Baik", "Sedang", "Perlu Perbaikan"]

@api.route('/generate-dummy-data', methods=['GET'])
def generate_dummy_data():
    try:
        existing_classes = {row.name for row in SchoolClass.query.all()}
        for class_name in KELAS_LIST:
            if class_name not in existing_classes:
                db.session.add(SchoolClass(name=class_name))
        db.session.commit()

        # 1. BERSIHKAN DATABASE LAMA (Opsional, agar data bersih)
        # Hati-hati, ini akan menghapus semua data!
        db.session.query(Note).delete()
        db.session.query(RecordSiswaHarian).delete()
        db.session.query(RecordSiswaMingguan).delete()
        db.session.query(User).delete()
        db.session.commit()

        print("--- Database dibersihkan ---")

        # Hash password sekali saja untuk performa
        hashed_pw = bcrypt.generate_password_hash(PASSWORD_DEFAULT).decode('utf-8')

        users_siswa = []
        users_guru = []

        # 2. BUAT ADMIN
        for i in range(TOTAL_ADMIN):
            admin = User(
                fullname=f"Admin {i+1}",
                email=f"admin{i+1}@sekolah.id",
                password_hash=hashed_pw,
                role="admin",
                kode=f"ADM-{faker.unique.random_number(digits=3)}",
                kelas=random.choice(KELAS_LIST)
            )
            db.session.add(admin)
        
        # 3. BUAT GURU
        for i in range(TOTAL_GURU):
            guru = User(
                fullname=f"Guru {i+1}",
                email=f"guru{i+1}@sekolah.id",
                password_hash=hashed_pw,
                role="guru",
                kode=f"GRU-{faker.unique.random_number(digits=3)}",
                kelas=random.choice(KELAS_LIST) # Guru wali kelas acak
            )
            db.session.add(guru)
            users_guru.append(guru)

        # 4. BUAT SISWA (USER)
        for i in range(TOTAL_SISWA):
            kelas_siswa = random.choice(KELAS_LIST)
            siswa = User(
                fullname=f"Siswa {i+1}",
                email=f"siswa{i+1}@sekolah.id",
                password_hash=hashed_pw,
                role="user",
                kode=f"SIS-{faker.unique.random_number(digits=4)}",
                kelas=kelas_siswa
            )
            db.session.add(siswa)
            users_siswa.append(siswa)

        # Commit user dulu agar mendapat ID
        db.session.commit()
        print(f"--- {TOTAL_SISWA} Siswa, {TOTAL_GURU} Guru, {TOTAL_ADMIN} Admin dibuat ---")

        # 5. GENERATE RECORD (HARIAN & MINGGUAN)
        today = date.today()
        records_harian = []
        records_mingguan = []

        for siswa in users_siswa:
            # Loop mundur dari hari ini ke RENTANG_HARI yang lalu
            for day_offset in range(RENTANG_HARI):
                current_date = today - timedelta(days=day_offset)
                
                # --- Record Harian (Setiap hari kecuali weekend opsional, disini kita buat full) ---
                # Randomize values 1-5 (Likert)
                rec_harian = RecordSiswaHarian(
                    user_id=siswa.id,
                    date=current_date,
                    bahagia=random.randint(2, 5), # Cenderung bahagia agar data variatif
                    semangat=random.randint(1, 5),
                    fokus=random.randint(1, 5),
                    bertenaga=random.randint(1, 5),
                    stress=random.randint(1, 4),  # Stress rendah -> skor tinggi
                    dukungan_teman=random.randint(2, 5),
                    dukungan_guru=random.randint(2, 5),
                    aman=random.randint(3, 5),
                    rasakan=faker.sentence() if random.random() > 0.7 else None # 30% isi teks
                )
                # Hitung skor (penting agar tidak null di DB)
                rec_harian.calculate_score()
                records_harian.append(rec_harian)

                # --- Record Mingguan (Setiap 7 hari sekali) ---
                if day_offset % 7 == 0:
                    is_bullying = 1 if random.random() < 0.1 else 0 # 10% chance bullying
                    rec_mingguan = RecordSiswaMingguan(
                        user_id=siswa.id,
                        date=current_date,
                        bahagia=random.randint(2, 5),
                        semangat=random.randint(2, 5),
                        beban=random.randint(1, 4), # Beban rendah -> skor tinggi
                        cemas=random.randint(1, 4),
                        bantuan_guru=random.randint(2, 5),
                        menghargai=random.randint(3, 5),
                        aman=random.randint(3, 5),
                        bullying=is_bullying,
                        desc_bullying=faker.sentence() if is_bullying == 1 else None,
                        tidur=random.choice(OPSI_TIDUR),
                        kehadiran=random.choice(OPSI_KEHADIRAN),
                        open_question=faker.sentence() if random.random() > 0.5 else None
                    )
                    rec_mingguan.calculate_score()
                    records_mingguan.append(rec_mingguan)

        # Bulk insert untuk performa lebih cepat
        db.session.add_all(records_harian)
        db.session.add_all(records_mingguan)
        db.session.commit()
        print(f"--- Records Harian & Mingguan untuk {RENTANG_HARI} hari terakhir dibuat ---")

        # 6. GENERATE NOTES (CATATAN GURU UNTUK SISWA)
        # Buat beberapa note acak
        notes = []
        for _ in range(30): # 30 catatan acak
            random_guru = random.choice(users_guru)
            random_siswa = random.choice(users_siswa)
            
            note = Note(
                message=faker.text(max_nb_chars=100),
                date=today - timedelta(days=random.randint(0, RENTANG_HARI)),
                creator_id=random_guru.id,
                target_id=random_siswa.id
            )
            notes.append(note)
        
        db.session.add_all(notes)
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": f"Berhasil generate data dummy: {TOTAL_SISWA} Siswa, {TOTAL_GURU} Guru, Record {RENTANG_HARI} Hari."
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error generating dummy data: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
