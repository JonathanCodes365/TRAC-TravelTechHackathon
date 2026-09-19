import random
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

from features import build_feature_vector, FEATURE_NAMES

random.seed(42)

NAMES = ["John Smith", "Hari Thapa", "Ram Bahadur", "Mike Johnson",
         "Sita Gurung", "Anita Rai", "David Lee", "Priya Sharma"]
NAME_VARIANTS = {
    "John Smith": ["Jon Smith", "J. Smith", "John Smyth"],
    "Hari Thapa": ["Hari Thapa Magar", "Hari T.", "Hari"],
    "Ram Bahadur": ["Ram B.", "Ram Bahadur Thapa", "Ramesh Bahadur"],
    "Mike Johnson": ["Michael Johnson", "Mike J.", "M. Johnson"],
    "Sita Gurung": ["Sita Gurung Magar", "Sita G."],
    "Anita Rai": ["Anita R.", "Anita Raii"],
    "David Lee": ["Dave Lee", "D. Lee"],
    "Priya Sharma": ["Priya S.", "Priya Sharma Poudel"],
}
LOCATIONS = ["Timure", "Langtang", "Rasuwa", "Tokha", "Kathmandu", "Dhunche"]
STATUSES = ["missing", "injured", "rescued", "safe"]


def random_time(base_hour=16, jitter_minutes=0):
    minute_offset = random.randint(-jitter_minutes, jitter_minutes) if jitter_minutes else 0
    total_minutes = base_hour * 60 + minute_offset
    h, m = divmod(total_minutes % (24 * 60), 60)
    return f"2026-09-19T{h:02d}:{m:02d}:00"


def make_duplicate_pair():
    base_name = random.choice(NAMES)
    name_b = random.choice(NAME_VARIANTS[base_name] + [base_name])
    location = random.choice(LOCATIONS)
    base_time = random.randint(8, 20)

    status_a = random.choice(STATUSES)
    status_b = status_a if random.random() < 0.6 else random.choice(STATUSES)

    count = random.choice([1, 1, 1, 2, 3])

    record_a = {"name": base_name, "location": location, "status": status_a,
                "time": random_time(base_time), "people_count": count}
    record_b = {"name": name_b, "location": location, "status": status_b,
                "time": random_time(base_time, jitter_minutes=25),
                "people_count": count + random.choice([0, 0, 0, 1])}
    return record_a, record_b, 1


def make_non_duplicate_pair():
    name_a, name_b = random.sample(NAMES, 2)
    location_a = random.choice(LOCATIONS)
    location_b = random.choice(LOCATIONS)
    if random.random() < 0.2:
        location_b = location_a

    record_a = {"name": name_a, "location": location_a,
                "status": random.choice(STATUSES),
                "time": random_time(random.randint(6, 22)),
                "people_count": random.choice([1, 2, 3])}
    record_b = {"name": name_b, "location": location_b,
                "status": random.choice(STATUSES),
                "time": random_time(random.randint(6, 22)),
                "people_count": random.choice([1, 2, 3])}
    return record_a, record_b, 0


def generate_dataset(n_per_class=150):
    X, y = [], []
    for _ in range(n_per_class):
        a, b, label = make_duplicate_pair()
        X.append(build_feature_vector(a, b))
        y.append(label)
    for _ in range(n_per_class):
        a, b, label = make_non_duplicate_pair()
        X.append(build_feature_vector(a, b))
        y.append(label)
    return np.array(X), np.array(y)


def main():
    X, y = generate_dataset(n_per_class=150)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = LogisticRegression()
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred, target_names=["not_duplicate", "duplicate"]))

    for name, weight in zip(FEATURE_NAMES, model.coef_[0]):
        print(f"{name:22s} {weight:+.3f}")
    print(f"{'bias':22s} {model.intercept_[0]:+.3f}")

    joblib.dump(model, "model.pkl")


if __name__ == "__main__":
    main()