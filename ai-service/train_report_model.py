import random
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression

from report_features import build_report_feature_vector

random.seed(42)

TYPES = ["rescue", "missing", "injured", "safe", "incident"]
LOCATIONS = ["Timure", "Langtang", "Rasuwa", "Tokha", "Kathmandu", "Dhunche"]

BASE_MESSAGES = [
    "Three tourists were rescued near {loc} at 4 PM",
    "A trekker named Hari has gone missing near {loc}",
    "Injured hiker found on the trail close to {loc}",
    "Group of five confirmed safe after evacuation from {loc}",
    "Landslide blocked the main road near {loc}",
]
REWORDINGS = [
    "{loc}: three tourists rescued around 4pm today",
    "Missing trekker Hari last seen near {loc}",
    "An injured hiker was located near {loc} on the trail",
    "Five people evacuated from {loc}, all confirmed safe",
    "Road near {loc} blocked due to landslide",
]


def random_time(base_hour, jitter=0):
    m = base_hour * 60 + random.randint(-jitter, jitter)
    h, mm = divmod(m % (24 * 60), 60)
    return f"2026-09-19T{h:02d}:{mm:02d}:00"


def make_duplicate_pair():
    idx = random.randrange(len(BASE_MESSAGES))
    loc = random.choice(LOCATIONS)
    rtype = TYPES[idx]
    base_hour = random.randint(8, 20)
    a = {"message": BASE_MESSAGES[idx].format(loc=loc), "type": rtype, "location": loc,
         "time": random_time(base_hour)}
    b = {"message": REWORDINGS[idx].format(loc=loc), "type": rtype, "location": loc,
         "time": random_time(base_hour, jitter=25)}
    return a, b, 1


def make_non_duplicate_pair():
    idx_a, idx_b = random.sample(range(len(BASE_MESSAGES)), 2)
    loc_a, loc_b = random.choice(LOCATIONS), random.choice(LOCATIONS)
    a = {"message": BASE_MESSAGES[idx_a].format(loc=loc_a), "type": TYPES[idx_a], "location": loc_a,
         "time": random_time(random.randint(6, 22))}
    b = {"message": BASE_MESSAGES[idx_b].format(loc=loc_b), "type": TYPES[idx_b], "location": loc_b,
         "time": random_time(random.randint(6, 22))}
    return a, b, 0


def generate_dataset(n=150):
    X, y = [], []
    for _ in range(n):
        a, b, label = make_duplicate_pair()
        X.append(build_report_feature_vector(a, b))
        y.append(label)
    for _ in range(n):
        a, b, label = make_non_duplicate_pair()
        X.append(build_report_feature_vector(a, b))
        y.append(label)
    return np.array(X), np.array(y)


if __name__ == "__main__":
    X, y = generate_dataset(150)
    model = LogisticRegression()
    model.fit(X, y)
    joblib.dump(model, "report_model.pkl")
    print("Saved report_model.pkl")