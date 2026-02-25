from app import app, db
from app.models import SystemSetting
from datetime import datetime

app.app_context().push()

today = datetime.today().weekday()

if today in [0, 1, 2, 3]:
    SystemSetting.SystemSetting.query.filter_by(key="is_survey_harian_active").update({"value": "True"})
else:
    SystemSetting.SystemSetting.query.filter_by(key="is_survey_harian_active").update({"value": "False"})
    
if today == 4:
    SystemSetting.SystemSetting.query.filter_by(key="is_survey_mingguan_active").update({"value": "True"})
else:
    SystemSetting.SystemSetting.query.filter_by(key="is_survey_mingguan_active").update({"value": "False"})
    
db.session.commit()

