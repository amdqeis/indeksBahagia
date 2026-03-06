import json
import os
import re

from app.rbac import ALL_CLASSES_SCOPE

GOOGLE_SHEETS_DEFAULT_SPREADSHEET_ID = "1yV8VJPtHpnXa-shfzgandugA0CRmaXinQMld2XC8rVQ"
GOOGLE_SHEETS_EXPORT_HEADERS = [
    "Waktu Export",
    "Periode Mulai",
    "Periode Akhir",
    "Scope Kelas",
    "Kelas Siswa",
    "Nama Siswa",
    "Email Siswa",
    "Tanggal Survey",
    "Skor SHI",
    "Diekspor Oleh",
]
GOOGLE_SHEETS_ADMIN_WORKSHEET_TITLE = "Admin"


class GoogleSheetsExportService:
    """
    Exports data to a single spreadsheet with two modes:
    - rows mode: append all exports into one worksheet (recommended)
    - worksheet mode: route class scope to dedicated worksheet tabs
    """

    def __init__(self):
        self.spreadsheet_id = os.getenv("GOOGLE_SHEET_ID_SHI_EXPORT", GOOGLE_SHEETS_DEFAULT_SPREADSHEET_ID)
        self.export_mode = (os.getenv("GOOGLE_SHEET_EXPORT_MODE", "rows") or "rows").strip().lower()
        self.default_worksheet = (
            os.getenv("GOOGLE_SHEET_TAB_SHI_EXPORT") or os.getenv("GOOGLE_SHEET_DEFAULT_TAB") or "SHI Export"
        ).strip()
        self.admin_worksheet = (
            os.getenv("GOOGLE_SHEET_ADMIN_TAB") or GOOGLE_SHEETS_ADMIN_WORKSHEET_TITLE
        ).strip()

    def append_export_rows(self, kelas_scope, rows, actor_role=None):
        if not rows:
            return {"updated_rows": 0, "worksheet": None, "spreadsheet_id": self.spreadsheet_id}

        worksheet = self._resolve_worksheet(kelas_scope, actor_role=actor_role)
        self._ensure_headers(worksheet)

        worksheet.append_rows(rows, value_input_option="USER_ENTERED")

        return {
            "updated_rows": len(rows),
            "worksheet": worksheet.title,
            "spreadsheet_id": self.spreadsheet_id,
        }

    def _get_client(self):
        try:
            import gspread
        except ImportError as exc:
            raise ImportError("Library Google Sheets belum terpasang. Install: gspread dan google-auth.") from exc

        service_account_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
        service_account_file = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE")

        if service_account_json:
            try:
                credentials = json.loads(service_account_json)
            except json.JSONDecodeError as exc:
                raise ValueError("GOOGLE_SERVICE_ACCOUNT_JSON tidak valid") from exc
            return gspread.service_account_from_dict(credentials)

        if service_account_file:
            return gspread.service_account(filename=service_account_file)

        raise ValueError(
            "Credential Google Sheets belum tersedia. "
            "Set GOOGLE_SERVICE_ACCOUNT_JSON atau GOOGLE_SERVICE_ACCOUNT_FILE."
        )

    def _open_spreadsheet(self):
        import gspread

        client = self._get_client()
        try:
            return client.open_by_key(self.spreadsheet_id)
        except gspread.SpreadsheetNotFound as exc:
            raise ValueError("Spreadsheet Google Sheets tidak ditemukan atau tidak bisa diakses") from exc

    def _resolve_worksheet(self, kelas_scope, actor_role=None):
        spreadsheet = self._open_spreadsheet()
        normalized_role = (actor_role or "").strip().lower()

        if normalized_role == "admin":
            return self._get_or_create_worksheet(spreadsheet, self._sanitize_worksheet_title(self.admin_worksheet))

        if normalized_role in {"guru", "siswa"}:
            if kelas_scope == ALL_CLASSES_SCOPE:
                raise ValueError("Role non-admin tidak boleh export ke scope semua kelas.")
            return self._get_or_create_worksheet(spreadsheet, self._worksheet_title_from_scope(kelas_scope))

        if self.export_mode == "worksheet":
            target_title = self._worksheet_title_from_scope(kelas_scope)
        else:
            target_title = self.default_worksheet

        return self._get_or_create_worksheet(spreadsheet, self._sanitize_worksheet_title(target_title))

    def _get_or_create_worksheet(self, spreadsheet, title):
        import gspread

        try:
            return spreadsheet.worksheet(title)
        except gspread.WorksheetNotFound:
            return spreadsheet.add_worksheet(title=title, rows=1000, cols=30)

    def _ensure_headers(self, worksheet):
        header_row = worksheet.row_values(1)
        if header_row:
            return
        worksheet.update("A1:J1", [GOOGLE_SHEETS_EXPORT_HEADERS], value_input_option="RAW")

    def _worksheet_title_from_scope(self, kelas_scope):
        if kelas_scope == ALL_CLASSES_SCOPE:
            return "Semua Kelas"

        # Worksheet title constraints: max 100 chars, no : \\ / ? * [ ]
        cleaned = re.sub(r"[:\\/?*\[\]]", "-", kelas_scope).strip() or self.default_worksheet
        return cleaned[:100]

    def _sanitize_worksheet_title(self, title):
        cleaned = re.sub(r"[:\\/?*\[\]]", "-", (title or "").strip()) or self.default_worksheet
        return cleaned[:100]
