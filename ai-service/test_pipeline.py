from fastapi.testclient import TestClient
from service import app
import json

client = TestClient(app)

r = client.post("/extract", json={
    "report_text": "Three tourists were rescued near Timure at 4 PM."
})
print(r.status_code, json.dumps(r.json(), indent=2))

r = client.post("/check-duplicate", json={
    "new_record": {
        "name": "Hari Thapa",
        "location": "Timure",
        "status": "missing",
        "time": "2026-09-19T16:10:00",
        "people_count": 1
    },
    "existing_records": [
        {
            "id": "p1",
            "name": "Hari Thapa Magar",
            "location": "Timure",
            "status": "missing",
            "time": "2026-09-19T16:00:00",
            "people_count": 1
        },
        {
            "id": "p2",
            "name": "Mike Johnson",
            "location": "Dhunche",
            "status": "safe",
            "time": "2026-09-19T09:00:00",
            "people_count": 1
        }
    ]
})
print(r.status_code, json.dumps(r.json(), indent=2))